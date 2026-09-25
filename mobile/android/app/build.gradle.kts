import java.util.Properties

// Release signing. Put the upload keystore's details in android/key.properties
// (storeFile, storePassword, keyAlias, keyPassword); it and the keystore are
// git-ignored and never leave the machine that signs releases.
val releaseKeys = Properties().apply {
    val properties = rootProject.file("key.properties")
    if (properties.exists()) properties.inputStream().use { load(it) }
}

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "np.com.kapileshworcargo.kcpl_customer"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Each flavour sets its own applicationId below.
        applicationId = "np.com.kapileshworcargo.kcpl_customer"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // One codebase, two apps: `customer` (KCPL, lib/main.dart) and `ops`
    // (KCPL Ops, lib/ops/main.dart). Build with --flavor and -t together;
    // see mobile/README.md.
    buildFeatures {
        // The flavours name each app through a generated string resource.
        resValues = true
    }

    flavorDimensions += "app"
    productFlavors {
        create("customer") {
            dimension = "app"
            applicationId = "np.com.kapileshworcargo.kcpl_customer"
            resValue("string", "app_name", "KCPL")
        }
        create("ops") {
            dimension = "app"
            applicationId = "np.com.kapileshworcargo.kcpl_ops"
            resValue("string", "app_name", "KCPL Ops")
        }
    }

    signingConfigs {
        if (!releaseKeys.isEmpty) {
            create("release") {
                storeFile = file(releaseKeys.getProperty("storeFile"))
                storePassword = releaseKeys.getProperty("storePassword")
                keyAlias = releaseKeys.getProperty("keyAlias")
                keyPassword = releaseKeys.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Without key.properties a release build is debug-signed: fine for
            // testing on a phone, refused by the Play Store.
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    // On-device text recognition for scanning container numbers (see
    // MainActivity). The unbundled model comes from Google Play services
    // rather than adding megabytes to the app.
    implementation("com.google.android.gms:play-services-mlkit-text-recognition:19.0.1")
}

// Push needs the Firebase project's config: app/google-services.json, or one
// per flavour in app/src/customer/ and app/src/ops/. Until it is added the
// apps build and run with push shown as unavailable.
if (listOf("google-services.json", "src/customer/google-services.json", "src/ops/google-services.json").any { file(it).exists() }) {
    apply(plugin = "com.google.gms.google-services")
}
