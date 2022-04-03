/*
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Copyright 2022 Reza Mohammadi Ghayeghchi <remohammadi@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable no-undef, @typescript-eslint/no-unused-vars, no-unused-vars */
import "./style.css";

const magicLocs: { lat: number, lng: number, heading: number, title: string }[] = [
  { lat: 52.377335, lng: 4.913855, heading: 275, title: "Bimhuis" },
  { lat: 51.500909, lng: -0.124400, heading: 273, title: "London" },
];

const earthC = 40075017; // meter
const earthFactor = 360 / earthC;
const deg2rad = (deg: number) => (deg * Math.PI) / 180.0;

const chevronEl = document.getElementById("chevron") as HTMLDivElement
const hintEl = document.getElementById("hint") as HTMLDivElement
const jumpEl = document.getElementById("jump") as HTMLDivElement
const keysEl = document.getElementById("keys") as HTMLDivElement

interface LocationState {
  lat: number,
  lng: number,
  heading: number, // 0-359
  speed: number,  // km/s
  time: number // milliseconds
}

class DrivingSimulatorManager {
  _locState: LocationState = {
    lat: magicLocs[0].lat,
    lng: magicLocs[0].lng,
    heading: magicLocs[0].heading,
    speed: 0.0005,
    time: Date.now(),
  }
  _lastAppliedHeading = this._locState.heading - 1;
  _map?: google.maps.Map;
  _createClock?: NodeJS.Timer;

  _updateHint() {
    const speed = this._locState.speed * 3600;
    var speedStr = speed.toFixed(1);
    if (speed > 10) {
      speedStr = speed.toFixed(0);
    }
    const latStr = this._locState.lat.toFixed(6);
    const lngStr = this._locState.lng.toFixed(6);
    hintEl.innerHTML = `Speed: <code>${speedStr}</code> km/h
    | Heading: <code>${this._locState.heading}</code>
    <br> Lat,Lng: <code>${latStr}, ${lngStr}</code>`;
  }

  _updateHeading() {
    if (!this._map) return;
    if (this._lastAppliedHeading != this._locState.heading) {
      this._map.setHeading(this._locState.heading);
      const mapHeading = this._map.getHeading() || 0;
      if (mapHeading != this._locState.heading) {
        chevronEl.style.transform = `rotate(${this._locState.heading - mapHeading}deg)`;
      } else {
        chevronEl.style.transform = "";
      }
      this._lastAppliedHeading = this._locState.heading;
    }
  }

  updateMapLoc(forceUpdate = false) {
    const now = Date.now(); // milliseconds
    const timeDiff = now - this._locState.time;
    if (timeDiff < 10 && !forceUpdate) {
      return
    }

    const distance = this._locState.speed * timeDiff;  // meter
    if (Math.abs(distance) < 0.1 && !forceUpdate) {
      this._locState.time = now;
      return
    }

    const angleRadHeading = deg2rad(this._locState.heading);
    const changeX = distance * Math.cos(angleRadHeading) * earthFactor;
    const changeY = distance * Math.sin(angleRadHeading) * earthFactor;

    this._locState.lat += changeX;
    this._locState.lng += changeY;
    this._locState.time = now;

    if (this._map) {
      this._map.setCenter({ lat: this._locState.lat, lng: this._locState.lng })
    }

    this._updateHeading();
    this._updateHint();
  }

  jump(lat: string, lng: string, heading: string) {
    this._locState.lat = +lat;
    this._locState.lng = +lng;
    this._locState.heading = +heading;
    this._locState.speed = 0;
    this._locState.time = Date.now();
    this.updateMapLoc(true);
  }

  initMap() {
    this._map = new google.maps.Map(
      document.getElementById("map") as HTMLElement,
      {
        center: { lat: this._locState.lat, lng: this._locState.lng },
        zoom: 20,
        heading: this._locState.heading,
        mapTypeId: "satellite",
        disableDefaultUI: true,
        tilt: 60,
      }
    );
    document.addEventListener('keydown', (event) => {
      switch (event.key) {
        case "A":
        case "a":
          this._locState.heading = (this._locState.heading - 1) % 360;
          break;
        case "D":
        case "d":
          this._locState.heading = (this._locState.heading + 1) % 360;
          break;
        case "Q":
        case "q":
          this._locState.heading = (this._locState.heading + 355) % 360;
          break;
        case "E":
        case "e":
          this._locState.heading = (this._locState.heading + 5) % 360;
          break;
        case "W":
        case "w":
          this._locState.speed += 0.0005;
          break;
        case "S":
        case "s":
          this._locState.speed -= 0.0005;
          break;
        case " ":
          this._locState.speed /= 2;
          if (Math.abs(this._locState.speed) < 0.0001) {
            this._locState.speed = 0;
          }
          break;
        case "N":
        case "n":
          this._locState.speed *= 2;
          if (Math.abs(this._locState.speed) < 0.0025) {
            if (this._locState.speed < 0) {
              this._locState.speed = -0.0025;
            } else {
              this._locState.speed = 0.0025;
            }
          }
          break;
        case "?":
          keysEl.style.display = "block";
          break;
        case "J":
        case "j":
          jumpEl.style.display = "block";
          break;
        case "Escape":
          keysEl.style.display = "none";
          jumpEl.style.display = "none";
          break;
        case "R":
        case "r":
          break;
        default:
          return;
      }
      this.updateMapLoc(true);
    }, false);

    this._updateHint();
    jumpEl.innerHTML = `Jump <span class='close' onclick='this.parentNode.style.display = "none"; return false;'>X</span><br>`
    for (let loc of magicLocs) {
      jumpEl.innerHTML += `<span class="loc" onclick='document.getElementById("jLat").value="${loc.lat}"; document.getElementById("jLng").value="${loc.lng}"; document.getElementById("jHeading").value="${loc.heading}";'>${loc.title}</span>`;
    }
    jumpEl.innerHTML += `<br><div class="form">
      <input placeholder="Lat" type=text id="jLat" style="width: 5em">
      <input placeholder="Lng" type=text id="jLng" style="width: 5em">
      <input placeholder="Heading" type=text id="jHeading" style="width: 3em">
      <button onclick='simMgr.jump(document.getElementById("jLat").value, document.getElementById("jLng").value, document.getElementById("jHeading").value); this.blur();'>Go</button></div>`;

    if (this._createClock) {
      clearInterval(this._createClock);
    }
    this._createClock = setInterval(() => this.updateMapLoc(), 200);
  }
}

const simMgr = new DrivingSimulatorManager();

export { simMgr };
