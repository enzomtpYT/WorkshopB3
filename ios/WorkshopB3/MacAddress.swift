import Foundation
import CoreBluetooth

@objc(MacAddress)
class MacAddress: NSObject, CBPeripheralManagerDelegate {
  private var peripheralManager: CBPeripheralManager?
  private var resolveBlock: RCTPromiseResolveBlock?
  private var rejectBlock: RCTPromiseRejectBlock?
  
  @objc
  func getBluetoothMacAddress(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    self.resolveBlock = resolve
    self.rejectBlock = reject
    
    peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
  }
  
  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    switch peripheral.state {
    case .poweredOn:
      if let identifier = peripheral.value(forKey: "identifier") as? UUID {
        resolveBlock?(identifier.uuidString)
      } else {
        rejectBlock?("NO_MAC", "Could not get Bluetooth identifier", nil)
      }
    case .poweredOff:
      rejectBlock?("BLUETOOTH_OFF", "Bluetooth is powered off", nil)
    case .unauthorized:
      rejectBlock?("UNAUTHORIZED", "Bluetooth permission not granted", nil)
    case .unsupported:
      rejectBlock?("UNSUPPORTED", "Bluetooth not supported", nil)
    default:
      rejectBlock?("ERROR", "Bluetooth error: \(peripheral.state.rawValue)", nil)
    }
    
    peripheralManager = nil
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}