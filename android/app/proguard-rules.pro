# Aether native app ProGuard rules

# Gson model fields are accessed by reflection.
-keepclassmembers class com.aether.audio.player.model.** {
    <fields>;
}

# Keep Media3/ExoPlayer service metadata.
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Keep Parcelable/Serializable data.
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# Coroutines
-dontwarn kotlinx.coroutines.**
