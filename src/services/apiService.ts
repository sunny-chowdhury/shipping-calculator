import axios from 'axios';
import { USPSRateRequest } from '../types';

const USPS_API_BASE = 'https://api.usps.com/domestic-prices/v3';
const FEDEX_API_BASE = 'https://apis.fedex.com';

export class ApiService {
  private uspsApiKey: string | null = null;
  private fedexApiKey: string | null = null;
  private fedexSecret: string | null = null;

  constructor() {
    this.uspsApiKey = process.env.REACT_APP_USPS_API_KEY || null;
    this.fedexApiKey = process.env.REACT_APP_FEDEX_API_KEY || null;
    this.fedexSecret = process.env.REACT_APP_FEDEX_SECRET || null;
  }

  async getUSPSZone(originZip: string, destinationZip: string): Promise<string> {
    if (!this.uspsApiKey) {
      return this.calculateApproximateUSPSZone(originZip, destinationZip);
    }

    try {
      const response = await axios.post(
        `${USPS_API_BASE}/zone`,
        {
          originZIPCode: originZip.substring(0, 5),
          destinationZIPCode: destinationZip.substring(0, 5)
        },
        {
          headers: {
            'Authorization': `Bearer ${this.uspsApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.zone || this.calculateApproximateUSPSZone(originZip, destinationZip);
    } catch (error) {
      console.warn('USPS API failed, using approximation:', error);
      return this.calculateApproximateUSPSZone(originZip, destinationZip);
    }
  }

  async getFedExZone(originZip: string, destinationZip: string): Promise<string> {
    if (!this.fedexApiKey || !this.fedexSecret) {
      return this.calculateApproximateFedExZone(originZip, destinationZip);
    }

    try {
      const authResponse = await axios.post(
        `${FEDEX_API_BASE}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.fedexApiKey,
          client_secret: this.fedexSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const accessToken = authResponse.data.access_token;

      const zoneResponse = await axios.post(
        `${FEDEX_API_BASE}/rate/v1/rates/quotes`,
        {
          accountNumber: {
            value: process.env.REACT_APP_FEDEX_ACCOUNT_NUMBER
          },
          requestedShipment: {
            shipper: {
              address: {
                postalCode: originZip.substring(0, 5),
                countryCode: 'US'
              }
            },
            recipient: {
              address: {
                postalCode: destinationZip.substring(0, 5),
                countryCode: 'US'
              }
            },
            requestedPackageLineItems: [{
              weight: {
                units: 'LB',
                value: 1
              }
            }]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const zone = zoneResponse.data?.output?.rateReplyDetails?.[0]?.commit?.transitTime;
      return zone || this.calculateApproximateFedExZone(originZip, destinationZip);
    } catch (error) {
      console.warn('FedEx API failed, using approximation:', error);
      return this.calculateApproximateFedExZone(originZip, destinationZip);
    }
  }

  private calculateApproximateUSPSZone(originZip: string, destinationZip: string): string {
    const origin = parseInt(originZip.substring(0, 3));
    const destination = parseInt(destinationZip.substring(0, 3));
    const difference = Math.abs(origin - destination);

    if (difference <= 50) return '2';
    if (difference <= 100) return '3';
    if (difference <= 200) return '4';
    if (difference <= 300) return '5';
    if (difference <= 400) return '6';
    if (difference <= 500) return '7';
    if (difference <= 600) return '8';
    return '9';
  }

  private calculateApproximateFedExZone(originZip: string, destinationZip: string): string {
    const origin = parseInt(originZip.substring(0, 3));
    const destination = parseInt(destinationZip.substring(0, 3));
    const difference = Math.abs(origin - destination);

    if (difference <= 50) return '2';
    if (difference <= 150) return '3';
    if (difference <= 300) return '4';
    if (difference <= 600) return '5';
    if (difference <= 1000) return '6';
    if (difference <= 1400) return '7';
    if (difference <= 1800) return '8';
    return '9';
  }

  async getUSPSRate(request: USPSRateRequest): Promise<number> {
    if (!this.uspsApiKey) {
      throw new Error('USPS API key not configured');
    }

    try {
      const response = await axios.post(
        `${USPS_API_BASE}/total-rates/search`,
        {
          originZIPCode: request.originZIPCode,
          destinationZIPCode: request.destinationZIPCode,
          weight: request.weight,
          length: request.length,
          width: request.width,
          height: request.height,
          mailClass: 'GROUND_ADVANTAGE',
          processingCategory: 'MACHINABLE',
          rateIndicator: 'DR',
          priceType: 'COMMERCIAL'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.uspsApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.totalRate || 0;
    } catch (error) {
      console.error('USPS rate lookup failed:', error);
      throw error;
    }
  }
}