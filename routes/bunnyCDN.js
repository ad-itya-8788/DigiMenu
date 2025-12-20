// Bunny CDN service for image upload and deletion

const axios = require("axios");
require("dotenv").config();

class BunnyCDNService {
  constructor() {
    this.accessKey = process.env.BUNNY_ACCESS_KEY;
    this.storageZone = process.env.BUNNY_STORAGE_ZONE;
    this.cdnHostname = process.env.BUNNY_CDN_HOSTNAME;
    this.baseUrl = `https://storage.bunnycdn.com/${this.storageZone}`;
    this.cdnUrl = `https://${this.cdnHostname}`;
  }

  async uploadImage(fileBuffer, fileName, folder = "menu-items") {
    try {
      const filePath = `${folder}/${Date.now()}_${fileName}`;
      const uploadUrl = `${this.baseUrl}/${filePath}`;

      const response = await axios.put(uploadUrl, fileBuffer, {
        headers: {
          AccessKey: this.accessKey,
          "Content-Type": "application/octet-stream",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (response.status === 201 || response.status === 200) {
        const imageUrl = `${this.cdnUrl}/${filePath}`;
        return {
          success: true,
          url: imageUrl,
          path: filePath,
        };
      }

      throw new Error("Upload failed");
    } catch (error) {
      console.error("Bunny CDN Upload Error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  async deleteImage(filePath) {
    try {
      const pathToDelete = filePath.replace(this.cdnUrl + "/", "");
      const deleteUrl = `${this.baseUrl}/${pathToDelete}`;

      const response = await axios.delete(deleteUrl, {
        headers: {
          AccessKey: this.accessKey,
        },
      });

      if (response.status === 200 || response.status === 204) {
        return {
          success: true,
          message: "Image deleted successfully",
        };
      }

      throw new Error("Delete failed");
    } catch (error) {
      console.error("Bunny CDN Delete Error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  extractPathFromUrl(url) {
    if (!url) return null;
    if (url.includes(this.cdnUrl)) {
      return url.replace(this.cdnUrl + "/", "");
    }
    return url;
  }
}

module.exports = new BunnyCDNService();
