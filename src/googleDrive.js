const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

// Helper to handle API requests with authorization headers
async function fetchFromDrive(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Google Drive API error: ${response.statusText}`);
  return response.json();
}

export const GoogleDriveService = {
  // Find or create the dedicated app folder
  async getOrCreateFolder(token) {
    const query = encodeURIComponent("name = 'Thought Organizer App' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const data = await fetchFromDrive(`${DRIVE_API_URL}?q=${query}`, token);
    
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create folder if it doesn't exist
    const folderMetadata = {
      name: 'Thought Organizer App',
      mimeType: 'application/vnd.google-apps.folder',
    };
    const folder = await fetchFromDrive(DRIVE_API_URL, token, {
      method: 'POST',
      body: JSON.stringify(folderMetadata),
    });
    return folder.id;
  },

  // Find or create the data file inside our folder
  async getOrCreateDataFile(token, folderId) {
    const query = encodeURIComponent(`name = 'thoughts.json' and '${folderId}' in parents and trashed = false`);
    const data = await fetchFromDrive(`${DRIVE_API_URL}?q=${query}`, token);

    if (data.files && data.files.length > 0) {
      return { fileId: data.files[0].id, isNew: false };
    }

    // Create empty file initial metadata
    const metadata = {
      name: 'thoughts.json',
      parents: [folderId],
      mimeType: 'application/json',
    };
    
    const file = await fetchFromDrive(DRIVE_API_URL, token, {
      method: 'POST',
      body: JSON.stringify(metadata),
    });

    return { fileId: file.id, isNew: true };
  },

  // Download the thought array from JSON file
  async downloadThoughts(token, fileId) {
    const response = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return [];
    try {
      return await response.json();
    } catch {
      return [];
    }
  },

  // Overwrite the JSON file with updated thoughts list
  async uploadThoughts(token, fileId, thoughts) {
    const metadata = { mimeType: 'application/json' };
    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(thoughts),
    };

    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      media.body +
      closeDelimiter;

    const response = await fetch(`${UPLOAD_API_URL}/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) throw new Error('Failed to upload thoughts update.');
    return response.json();
  }
};