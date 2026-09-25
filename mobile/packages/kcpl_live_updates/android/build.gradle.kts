group = "np.com.kapileshworcargo.kcpl_live_updates"
version = "1.0"

plugins {
    id("com.android.library")
}

android {
    namespace = "np.com.kapileshworcargo.kcpl_live_updates"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.annotation:annotation:1.9.1")
}
