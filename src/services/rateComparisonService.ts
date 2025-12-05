import Papa from 'papaparse';
import { USPSRateData, FedExRateData, ShippingData } from '../types';
import { FEDEX_RATES_CSV } from '../data/fedexRates';
import { USPS_RATES_CSV } from '../data/uspsRates';

export class RateComparisonService {
  private uspsRates: USPSRateData[] = [];
  private fedexRates: FedExRateData[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const results = await Promise.allSettled([
        this.loadUSPSRates(),
        this.loadFedExRates()
      ]);

      // Log any failures but don't fail the entire initialization
      results.forEach((result, index) => {
        const service = index === 0 ? 'USPS' : 'FedEx';
        if (result.status === 'rejected') {
          console.error(`Failed to load ${service} rates:`, result.reason);
        } else {
          console.log(`Successfully loaded ${service} rates`);
        }
      });

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing rate comparison service:', error);
      // Still mark as initialized so the app doesn't break completely
      this.initialized = true;
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

              const startIndex = data.findIndex((row, index) => {
                // Check all columns for the header since CSV structure may vary
                for (let i = 0; i < Math.min(row.length, 5); i++) {
                  if (row[i] && row[i].toString().toLowerCase().includes('weight not over')) {
                    return true;
                  }
                }
                return false;
              });

              if (startIndex === -1) {
                console.error('USPS CSV parsing failed. Available data structure:');
                console.error('First 5 rows:', data.slice(0, 5));
                console.error('Row lengths:', data.slice(0, 10).map((row, i) => `Row ${i}: ${row.length} columns`));

                // Try alternative approach: look for numeric weight patterns
                const altStartIndex = data.findIndex((row, index) => {
                  return index > 2 && row.length > 8 &&
                         (row[0]?.toString().includes('oz') || row[1]?.toString().includes('oz') ||
                          row[0]?.toString().includes('lb') || row[1]?.toString().includes('lb'));
                });

                if (altStartIndex > 0) {
                  console.log('Using alternative header detection at row:', altStartIndex - 1);
                  // Use the row before the weight data as header
                  const headerRow = data[altStartIndex - 1];
                  if (headerRow && headerRow.length > 8) {
                    // Found header row, continue with altStartIndex - 1
                    return this.parseUSPSData(data, altStartIndex - 1);
                  }
                }

                throw new Error(`Could not find USPS rate data header. Checked ${data.length} rows.`);
              }

              return this.parseUSPSData(data, startIndex);
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

  private parseUSPSData(data: string[][], startIndex: number): Promise<void> {
    return new Promise((resolve) => {
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
    });
  }

  private async loadFedExRates(): Promise<void> {
    try {
      console.log('🔄 Loading FedEx rates from embedded data...');
      const csvText = FEDEX_RATES_CSV;
      console.log('📄 FedEx CSV length:', csvText.length);
      console.log('📄 FedEx CSV first 200 chars:', csvText.substring(0, 200));

      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (result) => {
            try {
              const data = result.data as string[][];
              console.log('📊 FedEx parsed data length:', data.length);
              console.log('📊 FedEx first 5 rows:', data.slice(0, 5));

              if (data.length < 3) {
                throw new Error(`Invalid FedEx rate data format - only ${data.length} rows found`);
              }

              const zoneHeaders = data[1].slice(1);
              console.log('🏷️ FedEx zone headers:', zoneHeaders);

              for (let i = 2; i < data.length; i++) {
                const row = data[i];
                if (row.length < 2 || !row[0]) {
                  console.log(`⏭️ Skipping FedEx row ${i}: insufficient data`);
                  continue;
                }

                const weight = row[0];
                const rateData: FedExRateData = { weight };

                for (let j = 1; j < row.length && j - 1 < zoneHeaders.length; j++) {
                  const zone = zoneHeaders[j - 1];
                  if (zone && row[j]) {
                    rateData[zone] = this.cleanRate(row[j]);
                  }
                }

                this.fedexRates.push(rateData);

                if (i <= 4) {
                  console.log(`➕ Added FedEx rate for ${weight}lbs:`, rateData);
                }
              }

              console.log(`✅ Loaded ${this.fedexRates.length} FedEx rate records`);
              console.log('📋 Sample FedEx rate data:', this.fedexRates.slice(0, 3));
              resolve();
            } catch (error) {
              console.error('❌ Error parsing FedEx CSV:', error);
              reject(error);
            }
          },
          error: (error: any) => {
            console.error('❌ Papa Parse error for FedEx:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error loading FedEx rates:', error);
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

    const zoneKey = `zone${zone}` as keyof USPSRateData;
    const rateValue = closestRate[zoneKey];

    if (typeof rateValue === 'string') {
      return this.parseRate(rateValue);
    }

    return 0;
  }

  public getNegotiatedFedExRate(weightInPounds: number, zone: string): number {
    console.log(`=== FedEx Rate Lookup Debug ===`);
    console.log(`Looking for weight: ${weightInPounds}lbs, zone: ${zone}`);
    console.log(`FedEx rates initialized: ${this.initialized}, count: ${this.fedexRates.length}`);

    if (!this.initialized || this.fedexRates.length === 0) {
      console.log('❌ FedEx rates not initialized or empty');
      return 0;
    }

    // Find the closest weight (equal or greater)
    let closestRate: FedExRateData | null = null;
    let minWeightDiff = Infinity;

    for (const rate of this.fedexRates) {
      const rateWeight = parseFloat(rate.weight);
      if (isNaN(rateWeight)) {
        console.log(`Skipping invalid weight: ${rate.weight}`);
        continue;
      }

      const weightDiff = rateWeight - weightInPounds;
      if (weightDiff >= 0 && weightDiff < minWeightDiff) {
        closestRate = rate;
        minWeightDiff = weightDiff;
        console.log(`Found better weight match: ${rateWeight}lbs (diff: ${weightDiff})`);
      }
    }

    // If no rate found for exact weight or above, use the highest weight available
    if (!closestRate && this.fedexRates.length > 0) {
      closestRate = this.fedexRates[this.fedexRates.length - 1];
      console.log(`Using highest weight rate: ${closestRate.weight}lbs`);
    }

    if (!closestRate) {
      console.log('❌ No FedEx rate found at all');
      return 0;
    }

    console.log(`Using rate for weight: ${closestRate.weight}lbs`);
    console.log(`Available zones in this rate:`, Object.keys(closestRate).filter(k => k !== 'weight'));

    // Direct zone lookup
    const directRate = closestRate[zone];
    if (directRate) {
      const parsedRate = this.parseRate(directRate);
      console.log(`✅ Found rate for zone ${zone}: ${directRate} → ${parsedRate}`);
      return parsedRate;
    }

    // Zone not found - log available zones for debugging
    console.log(`❌ Zone ${zone} not found. Available zones:`, Object.keys(closestRate).filter(k => k !== 'weight'));
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