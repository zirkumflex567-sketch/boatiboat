param(
    [string]$Configuration = "debug"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$AndroidDir = Join-Path $Root "android"
$OutDir = Join-Path $Root "build\android"
$Sdk = $env:ANDROID_HOME
if (-not $Sdk) { $Sdk = $env:ANDROID_SDK_ROOT }
if (-not $Sdk) { $Sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }

$Platform = Get-ChildItem (Join-Path $Sdk "platforms") -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
$BuildTools = Get-ChildItem (Join-Path $Sdk "build-tools") -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1

if (-not $Platform -or -not $BuildTools) {
    throw "Android SDK platform/build-tools not found."
}

$AndroidJar = Join-Path $Platform.FullName "android.jar"
$Aapt2 = Join-Path $BuildTools.FullName "aapt2.exe"
$D8 = Join-Path $BuildTools.FullName "d8.bat"
$ZipAlign = Join-Path $BuildTools.FullName "zipalign.exe"
$ApkSigner = Join-Path $BuildTools.FullName "apksigner.bat"

Remove-Item -LiteralPath $OutDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "classes") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "dex") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "gen") | Out-Null

$CompiledRes = Join-Path $OutDir "resources.zip"
& $Aapt2 compile --dir (Join-Path $AndroidDir "res") -o $CompiledRes
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

# ---------------------------------------------------------------------------
# Web-Inhalte fuer Offline-Betrieb in die APK-Assets buendeln.
# Die App laedt file:///android_asset/web/index.html und braucht kein Internet.
# ---------------------------------------------------------------------------
$Frontend = Join-Path $Root "frontend"
$Catalog = Join-Path $Root "app\official_catalog.json"
$AssetsRoot = Join-Path $OutDir "androidassets"
$WebDir = Join-Path $AssetsRoot "web"
$WebAssets = Join-Path $WebDir "assets"
New-Item -ItemType Directory -Force -Path $WebAssets | Out-Null

# komplettes Frontend nach web/assets kopieren
Copy-Item (Join-Path $Frontend "*") -Destination $WebAssets -Recurse -Force
# index.html und manifest gehoeren in den web/-Stamm (wegen "assets/"-Pfaden)
Move-Item (Join-Path $WebAssets "index.html") (Join-Path $WebDir "index.html") -Force
if (Test-Path (Join-Path $WebAssets "manifest.webmanifest")) {
    Copy-Item (Join-Path $WebAssets "manifest.webmanifest") (Join-Path $WebDir "manifest.webmanifest") -Force
}

# Fragenkatalog als JS einbetten -> window.__CATALOG__ (kein Netzwerk noetig)
$CatalogJson = Get-Content -LiteralPath $Catalog -Raw -Encoding UTF8
$CatalogJs = Join-Path $WebAssets "catalog.js"
Set-Content -LiteralPath $CatalogJs -Value ("window.__CATALOG__ = " + $CatalogJson + ";") -Encoding UTF8

# catalog.js vor app.js in die gebuendelte index.html einfuegen
$IndexPath = Join-Path $WebDir "index.html"
$IndexHtml = Get-Content -LiteralPath $IndexPath -Raw -Encoding UTF8
$IndexHtml = $IndexHtml -replace '<script src="assets/app.js"></script>', '<script src="assets/catalog.js"></script>`r`n    <script src="assets/app.js"></script>'
Set-Content -LiteralPath $IndexPath -Value $IndexHtml -Encoding UTF8

$UnsignedApk = Join-Path $OutDir "boatiboat-unsigned.apk"
& $Aapt2 link `
    -o $UnsignedApk `
    -I $AndroidJar `
    --manifest (Join-Path $AndroidDir "AndroidManifest.xml") `
    --java (Join-Path $OutDir "gen") `
    -A $AssetsRoot `
    --auto-add-overlay `
    $CompiledRes
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

$Sources = @(Get-ChildItem (Join-Path $AndroidDir "src") -Recurse -Filter "*.java" |
    ForEach-Object { $_.FullName })
$GeneratedSources = @(Get-ChildItem (Join-Path $OutDir "gen") -Recurse -Filter "*.java" |
    ForEach-Object { $_.FullName })
$SourceList = Join-Path $OutDir "sources.txt"
(@($Sources) + @($GeneratedSources)) | Set-Content -Path $SourceList

& javac -encoding UTF-8 -source 8 -target 8 -classpath $AndroidJar -d (Join-Path $OutDir "classes") "@$SourceList"
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$ClassesJar = Join-Path $OutDir "classes.jar"
& jar cf $ClassesJar -C (Join-Path $OutDir "classes") .
if ($LASTEXITCODE -ne 0) { throw "jar classes failed" }

& $D8 --min-api 23 --lib $AndroidJar --output (Join-Path $OutDir "dex") $ClassesJar
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

& jar uf $UnsignedApk -C (Join-Path $OutDir "dex") classes.dex
if ($LASTEXITCODE -ne 0) { throw "jar update failed" }

$AlignedApk = Join-Path $OutDir "boatiboat-aligned.apk"
& $ZipAlign -f 4 $UnsignedApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

$KeyStore = Join-Path $OutDir "boatiboat-debug.keystore"
& keytool -genkeypair -v `
    -keystore $KeyStore `
    -storepass android `
    -alias boatiboat `
    -keypass android `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Boatiboat Debug,O=Boatiboat,C=DE" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "keytool failed" }

$SignedApk = Join-Path $OutDir "boatiboat-debug.apk"
& $ApkSigner sign `
    --ks $KeyStore `
    --ks-key-alias boatiboat `
    --ks-pass pass:android `
    --key-pass pass:android `
    --out $SignedApk `
    $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

& $ApkSigner verify --verbose $SignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }

Write-Output $SignedApk
