package com.kaiserabbas.thoughtorganizer;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
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
                String sanitizedUserAgent = originalUserAgent
                    .replace("; wv", "")
                    .replaceAll("Version/\\d+\\.\\d+\\s?", "");
                settings.setUserAgentString(sanitizedUserAgent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
