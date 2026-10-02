package com.kaiserabbas.thoughtorganizer;

import android.app.Dialog;
import android.os.Bundle;
import android.os.Message;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                String originalUserAgent = settings.getUserAgentString();
                // Strip the embedded WebView markers ('; wv' and 'Version/X.X')
                // This resolves Google's 403 disallowed_useragent OAuth policy restriction
                final String sanitizedUserAgent = originalUserAgent
                    .replace("; wv", "")
                    .replaceAll("Version/\\d+\\.\\d+\\s?", "");
                settings.setUserAgentString(sanitizedUserAgent);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setSupportMultipleWindows(true);

                final WebChromeClient originalChromeClient = webView.getWebChromeClient();

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                        WebView popupWebView = new WebView(MainActivity.this);
                        WebSettings popupSettings = popupWebView.getSettings();
                        popupSettings.setJavaScriptEnabled(true);
                        popupSettings.setDomStorageEnabled(true);
                        popupSettings.setUserAgentString(sanitizedUserAgent);
                        popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);

                        final Dialog dialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                        dialog.setContentView(popupWebView);
                        dialog.show();

                        popupWebView.setWebChromeClient(new WebChromeClient() {
                            @Override
                            public void onCloseWindow(WebView window) {
                                dialog.dismiss();
                            }
                        });

                        popupWebView.setWebViewClient(new WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                                return false;
                            }
                        });

                        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                        transport.setWebView(popupWebView);
                        resultMsg.sendToTarget();
                        return true;
                    }

                    @Override
                    public void onCloseWindow(WebView window) {
                        if (originalChromeClient != null) {
                            originalChromeClient.onCloseWindow(window);
                        } else {
                            super.onCloseWindow(window);
                        }
                    }

                    @Override
                    public boolean onShowFileChooser(WebView webView, android.webkit.ValueCallback<android.net.Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                        if (originalChromeClient != null) {
                            return originalChromeClient.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                        }
                        return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                    }

                    @Override
                    public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                        if (originalChromeClient != null) {
                            return originalChromeClient.onConsoleMessage(consoleMessage);
                        }
                        return super.onConsoleMessage(consoleMessage);
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
