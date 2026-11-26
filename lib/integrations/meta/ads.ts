import "server-only";

// Ads reporting is a stub: status() says whether an ad account is set; summary() is not built yet.
import type { AdsReporter, AdsSummaryRow, IntegrationStatus } from "@/lib/integrations/types";
import { IntegrationNotConfiguredError, UnsupportedOperationError } from "../errors";
import type { MetaConfig } from "./config";

export const ADS_NOT_BUILT = "Ads reporting from the hub is not built yet. Use Meta Ads Manager for spend and results.";

export class MetaAdsReporter implements AdsReporter {
  constructor(private readonly config: MetaConfig) {}

  async status(): Promise<IntegrationStatus> {
    if (!this.config.adAccountId) return { state: "not_configured", missing: ["META_AD_ACCOUNT_ID"] };
    return { state: "connected", account: { id: this.config.adAccountId, name: this.config.adAccountId } };
  }

  async summary(): Promise<AdsSummaryRow[]> {
    throw new UnsupportedOperationError(ADS_NOT_BUILT);
  }
}

export class NotConnectedAdsReporter implements AdsReporter {
  constructor(private readonly missing: string[]) {}
  async status(): Promise<IntegrationStatus> {
    return { state: "not_configured", missing: this.missing };
  }
  async summary(): Promise<AdsSummaryRow[]> {
    throw new IntegrationNotConfiguredError(this.missing, "Meta ads are not connected.");
  }
}
