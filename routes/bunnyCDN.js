// ============================================
// 🖼️ BUNNY CDN SERVICE - IMAGE UPLOAD & MANAGEMENT
// ============================================
// Ye service images ko CDN pe upload aur delete karti hai
// BunnyCDN use karti hai (fast image delivery ke liye)

const axios = require("axios");
require("dotenv").config();

class BunnyCDNService {
  constructor() {
    // Environment variables se configuration load karo
    this.accessKey = process.env.BUNNY_ACCESS_KEY; // CDN access key
    this.storageZone = process.env.BUNNY_STORAGE_ZONE; // Storage zone name
    this.cdnHostname = process.env.BUNNY_CDN_HOSTNAME; // CDN hostname
    this.baseUrl = `https://storage.bunnycdn.com/${this.storageZone}`; // Upload URL
    this.cdnUrl = `https://${this.cdnHostname}`; // Public CDN URL
  }

  // 📤 Image upload karta hai CDN pe
  // Returns: Public CDN URL jisse image access ho sakti hai
  async uploadImage(fileBuffer, fileName, folder = "menu-items") {
    try {
      // Unique file path banao (timestamp add karke)
      const filePath = `${folder}/${Date.now()}_${fileName}`;
      const uploadUrl = `${this.baseUrl}/${filePath}`;

      // BunnyCDN API call karo image upload karne ke liye
      const response = await axios.put(uploadUrl, fileBuffer, {
        headers: {
          AccessKey: this.accessKey, // Authentication ke liye
          "Content-Type": "application/octet-stream", // Binary data
        },
        maxContentLength: Infinity, // No size limit
        maxBodyLength: Infinity,
      });

      // Upload successful hai to public URL return karo
      if (response.status === 201 || response.status === 200) {
        const imageUrl = `${this.cdnUrl}/${filePath}`;
        return {
          success: true,
          url: imageUrl, // Public CDN URL
          path: filePath, // Internal file path
        };
      }

      throw new Error("Upload failed");
    } catch (error) {
      console.error("❌ Bunny CDN Upload Error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  // 🗑️ Image delete karta hai CDN se
  async deleteImage(filePath) {
    try {
      // CDN URL se actual file path nikalo
      const pathToDelete = filePath.replace(this.cdnUrl + "/", "");
      const deleteUrl = `${this.baseUrl}/${pathToDelete}`;

      // BunnyCDN API call karo image delete karne ke liye
      const response = await axios.delete(deleteUrl, {
        headers: {
          AccessKey: this.accessKey, // Authentication ke liye
        },
      });

      // Delete successful
      if (response.status === 200 || response.status === 204) {
        return {
          success: true,
          message: "Image deleted successfully",
        };
      }

      throw new Error("Delete failed");
    } catch (error) {
      console.error("❌ Bunny CDN Delete Error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  // 🔍 URL se file path extract karta hai
  extractPathFromUrl(url) {
    if (!url) return null;
    if (url.includes(this.cdnUrl)) {
      return url.replace(this.cdnUrl + "/", "");
    }
    return url;
  }
}

// Export karo taaki dusri files use kar sakein
module.exports = new BunnyCDNService();
