/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import * as posedetection from '@tensorflow-models/pose-detection';

import * as params from './params';

import { mean, std } from 'mathjs';

export class Context {
  constructor() {
    this.video = document.getElementById('video');
    this.videofile = document.getElementById('videofile');
    this.canvas = document.getElementById('output');
    this.source = document.getElementById('currentVID');
    this.ctx = this.canvas.getContext('2d');
    const stream = this.canvas.captureStream();
    const options = {mimeType: 'video/webm; codecs=vp9'};
    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.ondataavailable = this.handleDataAvailable;
    this.accumulatedKeypoints = []; // Add this line to initialize the accumulated keypoints array

    const saveCsvButton = document.getElementById('save-csv');
    saveCsvButton.addEventListener('click', () => {
      this.saveKeypointsAsCSV();
    });

    const saveStatsButton = document.getElementById('save-stats');
    saveStatsButton.addEventListener('click', () => {
      //alert('Creating Statistics');
      this.saveKeypointsStatsAsCSV();
    });

    const saveAllButton = document.getElementById('save-all-stats');
    saveAllButton.addEventListener('click', () => {
      this.downloadCSV();
    });

    this.keypointsMovements = []; // Add this line to initialize the keypoints movements array
    this.keypointsFrequencies = new Map(); // Add this line to initialize the keypoints frequencies map

    //this.videoFileName = ''; // Add this line to store the video file name


  }

  drawCtx() {
    this.ctx.drawImage(
        this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
  }

  clearCtx() {
    this.ctx.clearRect(0, 0, this.video.videoWidth, this.video.videoHeight);
  }


  /**
   * Draw the keypoints and skeleton on the video.
   * @param poses A list of poses to render.
   */
  drawResults(poses) {
    for (const pose of poses) {
      this.drawResult(pose);
      //console.log(pose); //log pose data
      this.saveKeypoints(pose.keypoints); // Save keypoints to a JSON file
    }
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param pose A pose with keypoints to render.
   */
  drawResult(pose) {
    if (pose.keypoints != null) {
      this.drawKeypoints(pose.keypoints);
      this.drawSkeleton(pose.keypoints);
    }
  }

  /**
   * Draw the keypoints on the video.
   * @param keypoints A list of keypoints.
   */
  drawKeypoints(keypoints) {
    const keypointInd =
        posedetection.util.getKeypointIndexBySide(params.STATE.model);
    this.ctx.fillStyle = 'White';
    this.ctx.strokeStyle = 'White';
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    for (const i of keypointInd.middle) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = 'Green';
    for (const i of keypointInd.left) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = 'Orange';
    for (const i of keypointInd.right) {
      this.drawKeypoint(keypoints[i]);
    }
  }

  drawKeypoint(keypoint) {
    // If score is null, just show the keypoint.
    const score = keypoint.score != null ? keypoint.score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    if (score >= scoreThreshold) {
      const circle = new Path2D();
      circle.arc(keypoint.x, keypoint.y, params.DEFAULT_RADIUS, 0, 2 * Math.PI);
      this.ctx.fill(circle);
      this.ctx.stroke(circle);
    }
  }

  /**
   * Draw the skeleton of a body on the video.
   * @param keypoints A list of keypoints.
   */
  drawSkeleton(keypoints) {
    this.ctx.fillStyle = 'White';
    this.ctx.strokeStyle = 'White';
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    posedetection.util.getAdjacentPairs(params.STATE.model).forEach(([
                                                                      i, j
                                                                    ]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];

      // If score is null, just show the keypoint.
      const score1 = kp1.score != null ? kp1.score : 1;
      const score2 = kp2.score != null ? kp2.score : 1;
      const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

      if (score1 >= scoreThreshold && score2 >= scoreThreshold) {
        this.ctx.beginPath();
        this.ctx.moveTo(kp1.x, kp1.y);
        this.ctx.lineTo(kp2.x, kp2.y);
        this.ctx.stroke();
      }
    });
  }

  start() {
    this.mediaRecorder.start();
  }

  stop() {
    this.mediaRecorder.stop();
  }

  handleDataAvailable(event) {
    if (event.data.size > 0) {
      const recordedChunks = [event.data];

      // Download Video File.
      /**
      const blob = new Blob(recordedChunks, {type: 'video/webm'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      document.body.appendChild(a);
      
      a.style = 'display: none';
      a.href = url;
      a.download = 'pose.webm';
      
      a.click();
      window.URL.revokeObjectURL(url);
      **/

    }
  }


  // Save all keypoints to a JSON file
  saveKeypointsAll(keypoints) {
    const jsonData = JSON.stringify(keypoints);
    const blob = new Blob([jsonData], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'keypoints.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  // Save Selected keypoints Only to a JSON file
  saveKeypointsSelected(keypoints) {
    const filteredKeypoints = this.filterKeypoints(keypoints);
    const jsonData = JSON.stringify(filteredKeypoints);
    const blob = new Blob([jsonData], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'keypoints.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  saveKeypoints(keypoints) {
    const filteredKeypoints = this.filterKeypoints(keypoints);
    
    //add statistics
    if (this.accumulatedKeypoints.length > 0) {
      const previousKeypoints = this.accumulatedKeypoints[this.accumulatedKeypoints.length - 1];
      const keypointsMovements = this.calculateKeypointsMovements(filteredKeypoints, previousKeypoints);
      this.keypointsMovements.push(keypointsMovements);

      this.updateKeypointsFrequencies(keypointsMovements);
    }
    //end of adding statistics

    this.accumulatedKeypoints.push(filteredKeypoints);
  }


  // 버튼을 누르고 단일 영상의 keypoints 를 csv 로 저장한다. --2023
  saveKeypointsAsCSV() {
    const headers = ['name', 'x', 'y'];
    const csvRows = [headers.join(',')];

    for (const keypoints of this.accumulatedKeypoints) {
      for (const keypoint of keypoints) {
        const row = [keypoint.name, keypoint.x, keypoint.y];
        csvRows.push(row.join(','));
      }
    }

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    const videoFileName = localStorage.getItem('videoFileName');
    link.download = videoFileName + 'keypoints.csv';
    
    link.click();

    URL.revokeObjectURL(url);
  }

  filterKeypoints(keypoints) {
    const keypointsToKeep = [
      'left_shoulder',
      'right_shoulder',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
      'left_ankle',
      'right_ankle'
    ];

    /** returning all fields
      return keypoints.filter((keypoint) =>
      keypointsToKeep.includes(keypoint.name)  
    )
    */

    return keypoints
      .filter((keypoint) => keypointsToKeep.includes(keypoint.name))
      .map(({ name, x, y }) => ({ 
        name, 
        x: parseFloat(x.toFixed(4)), 
        y: parseFloat(y.toFixed(4)),
      })); // Remove the 'score' field
  }

//statistics
  calculateKeypointsMovements(currentKeypoints, previousKeypoints) {
    const movements = [];

    for (let i = 0; i < currentKeypoints.length; i++) {
      const movement = Math.sqrt(Math.pow(currentKeypoints[i].x - previousKeypoints[i].x, 2) +
                                 Math.pow(currentKeypoints[i].y - previousKeypoints[i].y, 2));
      movements.push({
        name: currentKeypoints[i].name,
        movement: parseFloat(movement.toFixed(4))
      });
    }

    return movements;
  }

  updateKeypointsFrequencies(keypointsMovements) {
    const movementThreshold = 0.01; // Adjust this value to control the sensitivity of movement detection

    for (const keypointMovement of keypointsMovements) {
      if (keypointMovement.movement > movementThreshold) {
        this.keypointsFrequencies.set(
          keypointMovement.name,
          (this.keypointsFrequencies.get(keypointMovement.name) || 0) + 1
        );
      }
    }
  }

  saveKeypointsStatsAsCSV00() {
    const headers = ['name', 'standard_deviation', 'magnitude_of_movement', 'frequency'];
    const csvRows = [headers.join(',')];

    for (let i = 0; i < this.accumulatedKeypoints[0].length; i++) {
      const keypointName = this.accumulatedKeypoints[0][i].name;
      const movements = this.keypointsMovements.map(movement => movement[i].movement);
      const standardDeviation = std(movements).toFixed(4);
      const magnitudeOfMovement = movements.reduce((a, b) => a + b, 0).toFixed(4);
      const frequency = this.keypointsFrequencies.get(keypointName) || 0;

      const row = [keypointName, standardDeviation, magnitudeOfMovement, frequency];
      csvRows.push(row.join(','));
    }

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'stats.csv';
    link.click();

    URL.revokeObjectURL(url);
  }


  saveKeypointsStatsAsCSV02() {
    const headers = [];
    const values = [];

    for (let i = 0; i < this.accumulatedKeypoints[0].length; i++) {
      headers.push(`${this.accumulatedKeypoints[0][i].name}_standard_deviation`);
      headers.push(`${this.accumulatedKeypoints[0][i].name}_magnitude_of_movement`);
      headers.push(`${this.accumulatedKeypoints[0][i].name}_frequency`);

      const movements = this.keypointsMovements.map(movement => movement[i].movement);
      const standardDeviation = std(movements).toFixed(4);
      const magnitudeOfMovement = movements.reduce((a, b) => a + b, 0).toFixed(4);
      //const frequency = this.keypointsFrequencies.get(keypointName) || 0;

      values.push(standardDeviation);
      values.push(magnitudeOfMovement);
      values.push(frequency);
    }

    const csvRows = [headers.join(','), values.join(',')];

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'stats_01.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  calculateStandardDeviation() {
    const stdDevs = [];

    for (let i = 0; i < this.accumulatedKeypoints[0].length; i++) {
      const keypointName = this.accumulatedKeypoints[0][i].name;
      const movements = this.keypointsMovements.map(movement => movement[i].movement);
      const standardDeviation = std(movements).toFixed(4);
      stdDevs.push({ name: keypointName, stdDev: parseFloat(standardDeviation) });
    }

    return stdDevs;
  }

  calculateMagnitude() {
    const magnitudes = [];

    for (let i = 0; i < this.accumulatedKeypoints[0].length; i++) {
      const keypointName = this.accumulatedKeypoints[0][i].name;
      const movements = this.keypointsMovements.map(movement => movement[i].movement);
      const magnitudeOfMovement = movements.reduce((a, b) => a + b, 0).toFixed(4);
      magnitudes.push({ name: keypointName, magnitude: parseFloat(magnitudeOfMovement) });
    }

    return magnitudes;
  }

  calculateFrequency(videoDuration) {
    const frequencies = [];

    for (let i = 0; i < this.accumulatedKeypoints[0].length; i++) {
      const keypointName = this.accumulatedKeypoints[0][i].name;
      const frequency = (this.keypointsFrequencies.get(keypointName) || 0) / videoDuration;
      frequencies.push({ name: keypointName, frequency: parseFloat(frequency.toFixed(4)) });
    }

    return frequencies;
  }


  saveKeypointsStatsAsCSV_single() {

    const videoFileName = localStorage.getItem('videoFileName');
    const csvFileName = videoFileName + '_stats.csv';
    
    const stdDevs = this.calculateStandardDeviation();
    const magnitudes = this.calculateMagnitude();
    const frequencies = this.calculateFrequency(10); // Replace 10 with the actual duration of your video in seconds

    const headers = [];
    const values = [];

    headers.push('videoFileName');
    values.push(videoFileName);

    for (let i = 0; i < stdDevs.length; i++) {
      headers.push(`${stdDevs[i].name}_standard_deviation`);
      headers.push(`${stdDevs[i].name}_magnitude_of_movement`);
      headers.push(`${stdDevs[i].name}_frequency`);

      values.push(stdDevs[i].stdDev);
      values.push(magnitudes[i].magnitude);
      values.push(frequencies[i].frequency);
    }

    const csvRows = [headers.join(','), values.join(',')];

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName;
    link.click();

    URL.revokeObjectURL(url);
  }

  saveKeypointsStatsAsCSV() {

    const videoFileName = localStorage.getItem('videoFileName');
    const csvFileName = videoFileName + '_stats.csv';
    
    const stdDevs = this.calculateStandardDeviation();
    const magnitudes = this.calculateMagnitude();
    const frequencies = this.calculateFrequency(10); // Replace 10 with the actual duration of your video in seconds

    const headers = [];
    const values = [];

    headers.push('videoFileName');
    values.push(videoFileName);

    for (let i = 0; i < stdDevs.length; i++) {
      headers.push(`${stdDevs[i].name}_standard_deviation`);
      headers.push(`${stdDevs[i].name}_magnitude_of_movement`);
      headers.push(`${stdDevs[i].name}_frequency`);

      values.push(stdDevs[i].stdDev);
      values.push(magnitudes[i].magnitude);
      values.push(frequencies[i].frequency);
    }

    const csvRow = values.join(',');

    // Get the existing CSV data from localStorage or initialize it with the headers
    const existingCSVData = localStorage.getItem('csvData') || headers.join(',');

    // Append the new row to the existing CSV data
    const newCSVData = existingCSVData + '\n' + csvRow;

    // Save the new CSV data to localStorage
    localStorage.setItem('csvData', newCSVData);

    
  }

  downloadCSV() {
    //const videoFileName = localStorage.getItem('videoFileName');
    const csvFileName = '_stats.csv';
    const csvData = localStorage.getItem('csvData');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName;
    link.click();

    URL.revokeObjectURL(url);

    // Clear the CSV data from localStorage after downloading
    localStorage.removeItem('csvData');
  }  


}

