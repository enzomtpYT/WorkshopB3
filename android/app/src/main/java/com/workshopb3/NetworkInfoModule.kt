package com.workshopb3

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.pm.PackageManager
import android.Manifest
import android.os.Build
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class NetworkInfoModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), PermissionListener {
    private var pendingPromise: Promise? = null
    private val REQUEST_CODE_BLUETOOTH_PERMISSIONS = 1

    override fun getName(): String = "NetworkInfo"

    private fun checkAndRequestPermissions(promise: Promise) {
        val activity = reactContext.currentActivity as? PermissionAwareActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12 (API 31) et supérieur
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
        } else {
            // Android 11 (API 30) et inférieur
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.BLUETOOTH) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH)
            }
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }

        if (permissionsToRequest.isEmpty()) {
            // Toutes les permissions sont déjà accordées
            getMacAddress(promise)
        } else {
            pendingPromise = promise
            activity.requestPermissions(
                permissionsToRequest.toTypedArray(),
                REQUEST_CODE_BLUETOOTH_PERMISSIONS,
                this
            )
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean {
        if (requestCode == REQUEST_CODE_BLUETOOTH_PERMISSIONS) {
            val promise = pendingPromise ?: return false
            pendingPromise = null

            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                getMacAddress(promise)
            } else {
                promise.reject("PERMISSION_DENIED", "Required permissions were not granted")
            }
            return true
        }
        return false
    }

    @ReactMethod
    fun getBluetoothMacAddress(promise: Promise) {
        checkAndRequestPermissions(promise)
    }

    private fun getMacAddress(promise: Promise) {
        try {
            val bluetoothManager = reactContext.getSystemService(android.content.Context.BLUETOOTH_SERVICE) as BluetoothManager
            val adapter = bluetoothManager.adapter

            if (adapter == null) {
                promise.reject("NO_BLUETOOTH", "Device doesn't support Bluetooth")
                return
            }

            val macAddress = adapter.address
            if (!macAddress.isNullOrEmpty()) {
                promise.resolve(macAddress)
            } else {
                promise.reject("NO_MAC", "Could not get Bluetooth MAC address")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Could not get Bluetooth MAC address: ${e.message}", e)
        }
    }
}