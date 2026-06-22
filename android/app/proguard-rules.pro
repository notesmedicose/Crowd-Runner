# Crowd Brawler 3D - ProGuard/R8 Rules
# Keep Three.js and related libraries
-dontwarn three.**
-keep class three.** { *; }

# Keep Capacitor and AndroidX
-keep class com.getcapacitor.** { *; }
-keep class androidx.core.** { *; }

# Keep game entry point
-keep class com.notesmedicose.crowdrunner.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# General Android rules
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes Exceptions, Signature, InnerClasses

# Keep all native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JS interface classes used by Capacitor
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.PluginActivity { *; }