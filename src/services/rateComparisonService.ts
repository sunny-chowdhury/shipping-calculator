import Papa from 'papaparse';
import { USPSRateData, FedExRateData, UPSRateData, ShippingData } from '../types';
import { FEDEX_RATES_CSV } from '../data/fedexRates';
import { USPS_RATES_CSV } from '../data/uspsRates';
import { UPS_RATES_CSV } from '../data/upsRates';

export class RateComparisonService {
  private uspsRates: USPSRateData[] = [];
  private fedexRates: FedExRateData[] = [];
  private upsRates: UPSRateData[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Promise.all([
        this.loadUSPSRates(),
        this.loadFedExRates(),
        this.loadUPSRates()
      ]);
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing rate comparison service:', error);
      throw error;
    }
  }

  private async loadUSPSRates(): Promise<void> {
    try {
      console.log('🔄 Loading USPS rates from embedded data...');
      const csvText = USPS_RATES_CSV;

      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (result) => {
            try {
              const data = result.data as string[][];

              const startIndex = data.findIndex((row) => {
                // Check both first and second column since CSV has empty first column
                return (row[0] && row[0].toLowerCase().includes('weight not over')) ||
                       (row[1] && row[1].toLowerCase().includes('weight not over'));
              });

              if (startIndex === -1) {
                throw new Error('Could not find USPS rate data header');
              }

              for (let i = startIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (row.length < 11 || !row[1]) continue; // Check row[1] since first column is empty

                let weight = row[1].replace(/[^\d.]/g, ''); // Use row[1] for weight
                if (!weight) continue;

                // Convert ounces to pounds if needed
                if (row[1].toLowerCase().includes('oz')) {
                  const ozWeight = parseFloat(weight);
                  weight = (ozWeight / 16).toFixed(3); // Convert oz to lbs
                }

                const rateData: USPSRateData = {
                  weight,
                  zone1: this.cleanRate(row[2]), // Shift all zone columns by 1
                  zone2: this.cleanRate(row[3]),
                  zone3: this.cleanRate(row[4]),
                  zone4: this.cleanRate(row[5]),
                  zone5: this.cleanRate(row[6]),
                  zone6: this.cleanRate(row[7]),
                  zone7: this.cleanRate(row[8]),
                  zone8: this.cleanRate(row[9]),
                  zone9: this.cleanRate(row[10])
                };

                this.uspsRates.push(rateData);
              }

              console.log(`Loaded ${this.uspsRates.length} USPS rate records`);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          error: reject
        });
      });
    } catch (error) {
      console.error('Error loading USPS rates:', error);
      throw error;
    }
  }

  private async loadFedExRates(): Promise<void> {
    try {
      const csvText = FEDEX_RATES_CSV;

      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (result) => {
            try {
              const data = result.data as string[][];

              if (data.length < 3) {
                throw new Error('Invalid FedEx rate data format');
              }

              const zoneHeaders = data[1].slice(1);

              for (let i = 2; i < data.length; i++) {
                const row = data[i];
                if (row.length < 2 || !row[0]) continue;

                const weight = row[0];
                const rateData: FedExRateData = { weight };

                for (let j = 1; j < row.length && j - 1 < zoneHeaders.length; j++) {
                  const zone = zoneHeaders[j - 1];
                  if (zone && row[j]) {
                    rateData[zone] = this.cleanRate(row[j]);
                  }
                }

                this.fedexRates.push(rateData);
              }

              console.log(`Loaded ${this.fedexRates.length} FedEx rate records`);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          error: reject
        });
      });
    } catch (error) {
      console.error('Error loading FedEx rates:', error);
      throw error;
    }
  }

  private async loadUPSRates(): Promise<void> {
    try {
      const csvText = UPS_RATES_CSV;

      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (result) => {
            try {
              const data = result.data as string[][];

              if (data.length < 3) {
                throw new Error('Invalid UPS rate data format');
              }

              const zoneHeaders = data[1].slice(1);

              for (let i = 2; i < data.length; i++) {
                const row = data[i];
                if (row.length < 2 || !row[0]) continue;

                const weight = row[0];
                const rateData: UPSRateData = { weight };

                for (let j = 1; j < row.length && j - 1 < zoneHeaders.length; j++) {
                  const zone = zoneHeaders[j - 1];
                  if (zone && row[j]) {
                    rateData[zone] = this.cleanRate(row[j]);
                  }
                }

                this.upsRates.push(rateData);
              }

              console.log(`Loaded ${this.upsRates.length} UPS rate records`);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          error: reject
        });
      });
    } catch (error) {
      console.error('Error loading UPS rates:', error);
      throw error;
    }
  }

  private cleanRate(rateString: string): string {
    if (!rateString) return '0';
    return rateString.replace(/[$,\s]/g, '');
  }

  private parseRate(rateString: string): number {
    const cleaned = this.cleanRate(rateString);
    const rate = parseFloat(cleaned);
    return isNaN(rate) ? 0 : rate;
  }

  public getNegotiatedUSPSRate(weightInPounds: number, zone: string): number {
    if (!this.initialized || this.uspsRates.length === 0) return 0;

    let closestRate: USPSRateData | null = null;
    let minWeightDiff = Infinity;

    for (const rate of this.uspsRates) {
      const rateWeight = parseFloat(rate.weight);
      if (isNaN(rateWeight)) continue;

      if (rateWeight >= weightInPounds && rateWeight - weightInPounds < minWeightDiff) {
        closestRate = rate;
        minWeightDiff = rateWeight - weightInPounds;
      }
    }

    if (!closestRate) {
      const lastRate = this.uspsRates[this.uspsRates.length - 1];
      if (lastRate) closestRate = lastRate;
    }

    if (!closestRate) return 0;

    // Handle zone key format - API returns "8" but we need "zone8"
    // Handle zone key format - API returns "9" but we need "zone9"
    let zoneKey = `zone${zone}` as keyof USPSRateData;
    let rateValue = closestRate[zoneKey];

    // Special handling for Zone 9: USPS Ground Advantage only goes to Zone 8
    // Use Zone 8 rates as fallback for Zone 9 requests
    if (!rateValue && zone === '9') {
      zoneKey = 'zone8' as keyof USPSRateData;
      rateValue = closestRate[zoneKey];
      console.log(`Zone 9 not available for USPS, using Zone 8 rate as fallback`);
    }

    if (typeof rateValue === 'string' && rateValue.trim()) {
      return this.parseRate(rateValue);
    }

    // Debug: log what we're looking for vs what's available
    console.log(`USPS Zone lookup failed for zone "${zone}" (looking for "${zoneKey}")`);
    console.log('Available zone keys:', Object.keys(closestRate).filter(k => k !== 'weight'));
    console.log(`Weight: ${weightInPounds}lbs, using rate for: ${closestRate.weight}lbs`);

    return 0;
  }

  public getNegotiatedFedExRate(weightInPounds: number, zone: string): number {
    if (!this.initialized || this.fedexRates.length === 0) return 0;

    // Find the closest weight (equal or greater)
    let closestRate: FedExRateData | null = null;
    let minWeightDiff = Infinity;

    for (const rate of this.fedexRates) {
      const rateWeight = parseFloat(rate.weight);
      if (isNaN(rateWeight)) continue;

      if (rateWeight >= weightInPounds && rateWeight - weightInPounds < minWeightDiff) {
        closestRate = rate;
        minWeightDiff = rateWeight - weightInPounds;
      }
    }

    // If no rate found for exact weight or above, use the highest weight available
    if (!closestRate && this.fedexRates.length > 0) {
      closestRate = this.fedexRates[this.fedexRates.length - 1];
    }

    if (!closestRate) return 0;

    const rateValue = closestRate[zone];
    if (rateValue) {
      return this.parseRate(rateValue);
    }

    return 0;
  }

  public getNegotiatedUPSRate(weightInPounds: number, zone: string): number {
    if (!this.initialized || this.upsRates.length === 0) return 0;

    // Find the closest weight (equal or greater)
    let closestRate: UPSRateData | null = null;
    let minWeightDiff = Infinity;

    for (const rate of this.upsRates) {
      const rateWeight = parseFloat(rate.weight);
      if (isNaN(rateWeight)) continue;

      if (rateWeight >= weightInPounds && rateWeight - weightInPounds < minWeightDiff) {
        closestRate = rate;
        minWeightDiff = rateWeight - weightInPounds;
      }
    }

    // If no rate found for exact weight or above, use the highest weight available
    if (!closestRate && this.upsRates.length > 0) {
      closestRate = this.upsRates[this.upsRates.length - 1];
    }

    if (!closestRate) return 0;

    const rateValue = closestRate[zone];
    if (rateValue) {
      return this.parseRate(rateValue);
    }

    return 0;
  }

  public calculateSavings(shippingData: ShippingData, zone: string): {
    negotiatedRate: number;
    savings: number;
    isLoop: boolean;
  } {
    const weightInGrams = parseFloat(shippingData.PKG_WEIGHT_IN_GRAMS);
    const weightInPounds = weightInGrams / 453.592;
    const currentRate = parseFloat(
      shippingData.TOTAL_LABEL_RATE_SHOPPER_CURRENCY ||
      shippingData.TOTAL_LABEL_RATE_USD ||
      '0'
    );

    let negotiatedRate = 0;

    if (shippingData.CARRIER.toLowerCase().includes('fedex')) {
      negotiatedRate = this.getNegotiatedFedExRate(weightInPounds, zone);
    } else if (shippingData.CARRIER.toLowerCase().includes('usps')) {
      negotiatedRate = this.getNegotiatedUSPSRate(weightInPounds, zone);
    } else if (shippingData.CARRIER.toLowerCase().includes('ups')) {
      negotiatedRate = this.getNegotiatedUPSRate(weightInPounds, zone);
    }

    const savings = currentRate - negotiatedRate;
    const isLoop = savings > 0;

    return {
      negotiatedRate,
      savings,
      isLoop
    };
  }
}