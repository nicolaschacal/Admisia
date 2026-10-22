const { query } = require("./db");
const { normalizeType } = require("./business-types");

// Neutral defaults for a fresh install. Each client fills in their own data
// from the dashboard (Configuración → Negocio).
const DEFAULT_PROFILE = {
  businessType: "school",
  name: "Admisiones",
  category: "Educación",
  shortDescription: "",
  statusText: "",
  addressLine1: "",
  addressLine2: "",
  mapQuery: "",
  phoneDisplay: "",
  phoneE164: "",
  email: "",
  website: "",
  instagram: "",
  instagramLabel: "",
  facebook: "",
  facebookLabel: "",
  openHour: 8,
  closeHour: 18,
  weekdays: [1,2,3,4,5],
  badgeEnabled: true,
  logoUrl: "",
  brandColor: "",
  secondaryColor: "",
  welcomeMessage: "",
  assistantNotes: ""
};

async function getProfile() {
  try {
    const result = await query("SELECT value FROM crm_settings WHERE key='profile' LIMIT 1");
    const profile = { ...DEFAULT_PROFILE, ...(result.rows[0]?.value || {}) };
    profile.businessType = normalizeType(profile.businessType);
    return profile;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

module.exports = { DEFAULT_PROFILE, getProfile };
