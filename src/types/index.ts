export interface ShippingData {
  SHOP_ID: string;
  MERCHANT_NAME: string;
  CARRIER: string;
  LABEL_SERVICE: string;
  SHIPPING_INTEGRATION_NAME: string;
  TRACKING_NUMBER: string;
  PKG_WEIGHT_IN_GRAMS: string;
  TOTAL_LABEL_RATE_SHOPPER_CURRENCY: string;
  TOTAL_LABEL_RATE_USD: string;
  ORIGIN_CITY: string;
  ORIGIN_STATE: string;
  ORIGIN_ZIP: string;
  DESTINATION_CITY: string;
  DESTINATION_STATE: string;
  DESTINATION_ZIP: string;
  RETURN_ID: string;
  LABEL_CREATED_DATE: string;
  LABEL_UPDATE_DATE: string;
  zone?: string;
  negotiatedRate?: number;
  savings?: number;
  isLoop?: boolean;
}

export interface USPSRateData {
  weight: string;
  zone1: string;
  zone2: string;
  zone3: string;
  zone4: string;
  zone5: string;
  zone6: string;
  zone7: string;
  zone8: string;
  zone9: string;
}

export interface FedExRateData {
  weight: string;
  [zone: string]: string;
}

export interface UPSRateData {
  weight: string;
  [zone: string]: string;
}

export interface ZoneResponse {
  zone: string;
}

export interface USPSRateRequest {
  originZIPCode: string;
  destinationZIPCode: string;
  weight: number;
  length: number;
  width: number;
  height: number;
}