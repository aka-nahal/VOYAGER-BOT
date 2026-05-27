#include <BluetoothSerial.h>
#include <HardwareSerial.h>

// --- Configuration & Pins ---
#define BUZZER_PIN 4
#define EC200U_RX 26
#define EC200U_TX 27

// --- Objects ---
BluetoothSerial SerialBT;
HardwareSerial EC200USerial(1); // Single UART for both GSM and GPS

// --- State Variables ---
String ownerNumber = "+919309880045";
String triggers[10];
int triggerCount = 0;

// Geofence Variables
bool geofenceEnabled = false;
double geoCenterLat = 0.0;
double geoCenterLng = 0.0;
int geoRadius = 100;
double currentLat = 0.0;
double currentLng = 0.0;
unsigned long lastGpsPoll = 0;

void setup() {
  Serial.begin(115200);
  
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  // EC200U usually defaults to 115200 baud
  EC200USerial.begin(115200, SERIAL_8N1, EC200U_RX, EC200U_TX);
  SerialBT.begin("VOYAGERBOT");
  
  SerialBT.println("Connecting to VOYAGERBOT V1.0 ...");
  delay(1000);
  
  // Initialize EC200U
  sendATCommand("AT", "OK", 2000); // Wake up / check comms
  sendATCommand("AT+CMGF=1", "OK", 2000); // Set SMS to text mode
  
  SerialBT.println("✓ GSM Ready!");
  
  // Turn on GNSS engine
  String gpsStart = sendATCommand("AT+QGPS=1", "OK", 2000);
  if (gpsStart.indexOf("OK") != -1 || gpsStart.indexOf("504") != -1) { 
    // 504 error means GPS is already on
    SerialBT.println("GPS started");
  }

  sendSMS(ownerNumber, "Hey there It's VOYAGERBOT -_<\nyour smart LuggageRobot\n\nYou are now the OWNER!");
  SerialBT.println("System Ready!");
}

void loop() {
  // 1. Poll GPS periodically for Geofencing (every 5 seconds)
  if (millis() - lastGpsPoll > 5000) {
    updateLocation();
    lastGpsPoll = millis();
    
    // Check Geofence Breach
    if (geofenceEnabled && currentLat != 0.0 && currentLng != 0.0) {
      double distance = calculateDistance(currentLat, currentLng, geoCenterLat, geoCenterLng);
      if (distance > geoRadius) {
        triggerAlarm("Geofence breached!");
        geofenceEnabled = false; // Prevent continuous spamming
      }
    }
  }

  // 2. Process Bluetooth Commands
  if (SerialBT.available()) {
    String cmd = SerialBT.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      processCommand(cmd, true);
    }
  }

  // 3. Process incoming SMS (Simplified)
  if (EC200USerial.available()) {
    String incoming = EC200USerial.readString();
    // Parse incoming +CMT notifications here in production
  }
}

// --- EC200U specific GPS parsing ---
void updateLocation() {
  // AT+QGPSLOC=2 returns: +QGPSLOC: <UTC>,<lat>,<lon>,<hdop>,<alt>,<fix>,<cog>,...
  String response = sendATCommand("AT+QGPSLOC=2", "+QGPSLOC:", 2000);
  
  if (response.indexOf("+QGPSLOC:") != -1) {
    // Basic string splitting to extract Lat and Lng
    int firstComma = response.indexOf(',');
    int secondComma = response.indexOf(',', firstComma + 1);
    int thirdComma = response.indexOf(',', secondComma + 1);
    
    if (firstComma > 0 && secondComma > 0 && thirdComma > 0) {
      String latStr = response.substring(firstComma + 1, secondComma);
      String lngStr = response.substring(secondComma + 1, thirdComma);
      currentLat = latStr.toDouble();
      currentLng = lngStr.toDouble();
    }
  }
}

// --- Command Parser ---
void processCommand(String cmd, bool viaBT) {
  cmd.toLowerCase();

  // ----- BASIC COMMANDS -----
  if (cmd == "g") {
    updateLocation();
    if (currentLat != 0.0) {
      String loc = "GPS: https://maps.google.com/?q=" + String(currentLat, 6) + "," + String(currentLng, 6);
      respond(loc, viaBT);
    } else {
      respond("GPS not fixed yet.", viaBT);
    }
  } 
  else if (cmd == "s") {
    respond("System status: OK\nOwner: " + ownerNumber + "\nTriggers: " + String(triggerCount) + "\nGeofence: " + (geofenceEnabled ? "ENABLED" : "DISABLED"), viaBT);
  } 
  else if (cmd == "a") {
    beep(3, 200);
    respond("3 short beeps + confirmation + GPS", viaBT);
  } 
  else if (cmd == "b") {
    digitalWrite(BUZZER_PIN, HIGH);
    respond("Buzzer ON (continuous)", viaBT);
  } 
  else if (cmd == "o") {
    digitalWrite(BUZZER_PIN, LOW);
    respond("Buzzer OFF", viaBT);
  } 
  else if (cmd == "c") {
    respond("Calling...", viaBT);
    sendATCommand("ATD" + ownerNumber + ";", "OK", 5000); 
  } 
  else if (cmd == "x") {
    respond("Call ended", viaBT);
    sendATCommand("ATH", "OK", 2000); 
  } 
  else if (cmd == "h") {
    printHelp(viaBT);
  }

  // ----- OWNER & TRIGGER COMMANDS (Same as before) -----
  else if (cmd.startsWith("n +")) {
    String newOwner = cmd.substring(2);
    respond("Old owner: " + ownerNumber + "\nNew owner: " + newOwner, viaBT);
    ownerNumber = newOwner;
  }
  // [Trigger List Commands remain identical to previous version]

  // ----- GEOFENCING COMMANDS -----
  else if (cmd.startsWith("f set")) {
    updateLocation();
    if (currentLat != 0.0) {
      geoCenterLat = currentLat;
      geoCenterLng = currentLng;
      geofenceEnabled = true;
      
      if (cmd.length() > 5) {
        int r = cmd.substring(6).toInt();
        if (r >= 10 && r <= 5000) geoRadius = r;
      }
      respond("Geofence set at current GPS (" + String(geoRadius) + "m)", viaBT);
    } else {
      respond("GPS not fixed.", viaBT);
    }
  } 
  else if (cmd == "f off") {
    geofenceEnabled = false;
    respond("Geofencing disabled.", viaBT);
  }
}

// --- AT Command Utility ---
String sendATCommand(String command, String expected_response, unsigned long timeout) {
  String response = "";
  EC200USerial.println(command);
  long int time = millis();
  
  while ((time + timeout) > millis()) {
    while (EC200USerial.available()) {
      char c = EC200USerial.read();
      response += c;
    }
    if (response.indexOf(expected_response) != -1) {
      break;
    }
  }
  return response;
}

// --- Helper Functions ---
void respond(String msg, bool viaBT) {
  if (viaBT) SerialBT.println(msg);
  else sendSMS(ownerNumber, msg);
}

void sendSMS(String number, String text) {
  sendATCommand("AT+CMGS=\"" + number + "\"", ">", 2000);
  EC200USerial.print(text);
  EC200USerial.write(26); // CTRL+Z
  SerialBT.println("Sending SMS to: " + number);
}

void triggerAlarm(String reason) {
  digitalWrite(BUZZER_PIN, HIGH);
  sendSMS(ownerNumber, "ALARM! " + reason);
  sendATCommand("ATD" + ownerNumber + ";", "OK", 5000);
}

void beep(int times, int duration) {
  for(int i=0; i<times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
    delay(duration);
  }
}

// Haversine formula for geofence distance calculation (in meters)
double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  double R = 6371000; // Earth radius in meters
  double dLat = (lat2 - lat1) * PI / 180.0;
  double dLon = (lon2 - lon1) * PI / 180.0;
  lat1 = lat1 * PI / 180.0;
  lat2 = lat2 * PI / 180.0;
  double a = sin(dLat/2) * sin(dLat/2) + sin(dLon/2) * sin(dLon/2) * cos(lat1) * cos(lat2);
  double c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c;
}

void printHelp(bool viaBT) {
  String helpMsg = "VOYAGERBOT V1.0 COMMANDS:\ng - GPS location\ns - System status\na - Test alarm\nb - Buzzer ON\no - Buzzer OFF\nh - This help\n\nf set [radius] - Set Geofence\nf off - Disable Geofence";
  respond(helpMsg, viaBT);
}
