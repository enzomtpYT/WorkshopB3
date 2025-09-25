export interface DeviceAddresses {
  bluetoothMac: string;
  wifiDirectMac: string;
}

export enum ConnectionType {
  BLUETOOTH = 'BLUETOOTH',
  WIFI_DIRECT = 'WIFI_DIRECT'
}