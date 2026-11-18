import { IPN_PROFILES, getDoubleIPN, type ProfileData } from "./profiles";
import { UPN_PROFILES, upnToProfileData } from "./upn-profiles";

export type BeamProfileType = "IPN" | "UPN" | "2IPN";

/**
 * Resolve a stored (profileType, profileName) pair into the engineering
 * ProfileData used by the steel design engine.
 *
 * - "UPN" → UPN catalog entry converted via upnToProfileData
 * - "2IPN" → IPN catalog entry converted via getDoubleIPN (two IPN coplanar)
 * - otherwise (undefined / "IPN") → plain IPN catalog entry
 *
 * Imports stay one-directional: upn-profiles imports ProfileData only as a
 * type from profiles.ts, so importing both from this module is cycle-free.
 */
export function resolveProfile(
  profileType: string | undefined,
  profileName: string,
): ProfileData | undefined {
  if (profileType === "UPN") {
    const upn = UPN_PROFILES.find((p) => p.name === profileName);
    return upn ? upnToProfileData(upn) : undefined;
  }
  if (profileType === "2IPN") {
    const ipn = IPN_PROFILES.find((p) => p.name === profileName);
    return ipn ? getDoubleIPN(ipn) : undefined;
  }
  return IPN_PROFILES.find((p) => p.name === profileName);
}
