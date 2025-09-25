#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MacAddress, NSObject)
RCT_EXTERN_METHOD(getBluetoothMacAddress: (RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end