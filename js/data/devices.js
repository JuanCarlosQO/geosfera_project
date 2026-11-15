// Facts behind the Devices screen, quoted word for word (each is repeated in docs/SOURCES.md;
// tests/devices-core.test.js checks it). Read 15 Nov 2026.

const WEAR = "https://www.nasa.gov/missions/station/wearable-tech-for-space-station-research/";
const DAILY = "https://www.nasa.gov/blogs/stationreport/2023/10/17/iss-daily-summary-report-10-17-2023";
const PHILIPS = "https://www.philips.com/c-dam/b2bhc/master/sites/actigraphy/resources/newcase/actiwatch_device_comparison.pdf";
const WEBBT = "https://developer.chrome.com/docs/capabilities/bluetooth";
const SSM = "https://nlsp.nasa.gov/search/data/details/3a65fc6b-71da-5ce1-b9ef-0d208fbef40e?dataType=EXPERIMENTS";
const SSM_SRC = "NASA Life Sciences Portal, Spaceflight Standard Measures: Actigraphy (SSM_Actigraphy)";

export const DEVICE_FACTS = {
  actiwatch: { quote: "a device worn on the wrist, contains an accelerometer to measure motion and photodetectors to monitor ambient lighting", url: WEAR, source: "NASA, Wearable Tech for Space Station Research (2024)" },
  sleep: { quote: "It is an upgrade of previous technology used on the space station to monitor the length and quality of crew member sleep.", url: WEAR, source: "NASA, Wearable Tech for Space Station Research (2024)" },
  onStation: { quote: "Multiple crew members retrieved and donned their AWPs in support of the Standard Measures investigation.", url: DAILY, source: "NASA ISS Daily Summary Report, 17 Oct 2023" },
  memory: { quote: "The data is stored in non-volatile memory within the Actiwatch until it is downloaded for analysis.", url: DAILY, source: "NASA ISS Daily Summary Report, 17 Oct 2023" },
  usb: { quote: "Direct USB/Micro USB cable", url: PHILIPS, source: "Philips, Actiwatch specification sheet (Spectrum Plus, Communication)" },
  webBluetooth: { quote: "The Web Bluetooth API allows websites to communicate with Bluetooth devices.", url: WEBBT, source: "Chrome for Developers, Web Bluetooth" },
  groundDownload: { quote: "Every 32 days, crewmembers will doff the Actiwatch and connect the Actiwatch to a PC that will allow ground personnel to download the data and reconfigure the watch as needed.", url: SSM, source: SSM_SRC },
  nonDominant: { quote: "The Actiwatch is a wrist-watch like device worn on the wrist of the non-dominant arm that measures accelerations induced by wrist movements.", url: SSM, source: SSM_SRC },
  restricted: { quote: "Available datasets are accessible via data request.", url: SSM, source: SSM_SRC },
  webBluetoothWhere: { quote: "A subset of the Web Bluetooth API is available in ChromeOS, Chrome for Android 6.0", url: WEBBT, source: "Chrome for Developers, Web Bluetooth" }
};
