// Array to hold all shape objects in the simulation
let shapes = [];

// Flags to control simulation features
let gravityEnabled = false;          // Gravity is initially off
let energyTransferEnabled = false;   // Energy transfer mode off by default
let wallPushEnabled = false;         // Wall push mode off by default
let addObjectsEnabled = false;       // New objects are not added by default
let trailsEnabled = false;           // Trails are initially off
let annotationsEnabled = false;      // Annotations are initially off

// Constants and variables for velocity control
const defaultVelocityCap = 4;        // Default maximum velocity
const blastVelocityCap = 10;         // Maximum velocity during a blast
let velocityCap = defaultVelocityCap;// Current velocity cap, adjustable via slider
const dampingFactor = 0.9;           // Factor to reduce speed after collisions

// Variables related to the blasting ball feature
let blastTimer = 0;                  // Timer for the blasting ball
let blastingBall = null;             // Instance of the blasting ball
let blastActive = false;             // Indicates if the blast effect is active
let blinkState = true;               // Used to make the blast ball blink

// Intervals for adding and removing objects periodically
let addObjectsInterval;              // Interval to add new random objects every 30 seconds
let removeObjectsInterval;           // Interval to remove 10% of objects every 2 minutes

// Variables for Click and Hold to Create Circles
let isHolding = false;          // Tracks if the mouse is being held down
let holdStartTime = 0;          // Time when mouse was pressed
let mouseHoldPosition = null;   // Position where the mouse was pressed

// Variable to track fullscreen state
let isFullscreen = false;

class Shape {
  constructor(x, y, vx, vy, m, type, size = null) {
    this.x = x;                         // X-coordinate position
    this.y = y;                         // Y-coordinate position
    this.vx = vx;                       // Velocity in X-direction
    this.vy = vy;                       // Velocity in Y-direction
    this.m = m;                         // Mass of the shape
    this.type = type;                   // Type of shape ('circle', 'square', etc.)
    this.size = size || random(20, 40); // Use provided size or random size
    this.r = this.size / 2;             // Radius, used for collision detection
    this.color = color(0);              // Initial color (black)
    this.colorTimer = 0;                // Timer to manage color decay

    this.trail = [];           // Array to store previous positions
    this.maxTrailLength = 20;  // Maximum length of the trail
  }

  move() {
    if (gravityEnabled) {
      this.vy += 0.1; // Apply gravity by increasing Y-velocity
    }

    if (wallPushEnabled) {
      this.applyWallPush();            // Push the shape away from walls if enabled
    }

    // Update position based on velocity and adjust for current velocity cap
    this.x += this.vx * velocityCap / defaultVelocityCap;
    this.y += this.vy * velocityCap / defaultVelocityCap;

    // Handle collisions with canvas walls
    if (this.x - this.r < 0 || this.x + this.r > width) {
      this.vx = -this.vx * dampingFactor;  // Reverse X-velocity and apply damping
      if (energyTransferEnabled) this.changeColorBasedOnSpeed();  // Visualize collision
    }
    if (this.y - this.r < 0 || this.y + this.r > height) {
      this.vy = -this.vy * dampingFactor;  // Reverse Y-velocity and apply damping
      if (energyTransferEnabled) this.changeColorBasedOnSpeed();  // Visualize collision
    }

    // Apply velocity cap, higher during blast
    let cap = blastActive ? blastVelocityCap : velocityCap;
    this.vx = constrain(this.vx, -cap, cap);
    this.vy = constrain(this.vy, -cap, cap);

    // Gradually reset color to black over time
    if (this.colorTimer > 0) {
      this.colorTimer--;
    } else {
      this.color = color(0);           // Reset to black
    }

    // Update trail if enabled
    if (trailsEnabled) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift(); // Remove oldest position to maintain trail length
      }
    } else {
      // Clear the trail if trails are disabled
      this.trail = [];
    }
  }

  draw() {
    if (trailsEnabled) {
      // Draw the trail
      noFill();
      stroke(0, 50); // Semi-transparent stroke
      beginShape();
      for (let pos of this.trail) {
        vertex(pos.x, pos.y);
      }
      endShape();
    }

    fill(this.color);                  // Use the current color
    noStroke();

    // Draw shape based on its type
    if (this.type === 'circle') {
      ellipse(this.x, this.y, this.size);
    } else if (this.type === 'square') {
      rect(this.x - this.r, this.y - this.r, this.size, this.size);
    } else if (this.type === 'triangle') {
      triangle(
        this.x, this.y - this.r,            // Top point
        this.x - this.r, this.y + this.r,   // Bottom left
        this.x + this.r, this.y + this.r    // Bottom right
      );
    } else if (this.type === 'star') {
      this.drawStar(5, this.r, this.r / 2); // Draw a 5-pointed star
    }

    if (annotationsEnabled) {
      // Display annotations
      fill(0);
      noStroke();
      textSize(12);
      let speed = this.getSpeed().toFixed(2);
      text(`m: ${this.m.toFixed(2)}`, this.x + this.r + 5, this.y - this.r);
      text(`v: ${speed}`, this.x + this.r + 5, this.y - this.r + 15);
    }
  }

  // Function to draw a star shape
  drawStar(points, outerRadius, innerRadius) {
    let angle = TWO_PI / points;
    let halfAngle = angle / 2.0;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
      let sx = this.x + cos(a) * outerRadius;
      let sy = this.y + sin(a) * outerRadius;
      vertex(sx, sy);
      sx = this.x + cos(a + halfAngle) * innerRadius;
      sy = this.y + sin(a + halfAngle) * innerRadius;
      vertex(sx, sy);
    }
    endShape(CLOSE);
  }

  // Change color based on speed (after collision)
  changeColorBasedOnSpeed() {
    let speed = sqrt(this.vx * this.vx + this.vy * this.vy);
    let hue = map(speed, 0, blastVelocityCap, 0, 360);  // Map speed to color hue (0-360)
    this.color = color(hue, 255, 255);  // Use HSB color mode
    this.colorTimer = 30;  // Color will stay for 30 frames (roughly 0.5 seconds)
  }

  // Apply wall push effect (push objects away from walls)
  applyWallPush() {
    let wallPushStrength = 0.05;  // Strength of wall repulsion force

    if (this.x - this.r < 50) {
      this.vx += wallPushStrength * (50 - (this.x - this.r));  // Push from left wall
    }
    if (this.x + this.r > width - 50) {
      this.vx -= wallPushStrength * ((this.x + this.r) - (width - 50));  // Push from right wall
    }
    if (this.y - this.r < 50) {
      this.vy += wallPushStrength * (50 - (this.y - this.r));  // Push from top wall
    }
    if (this.y + this.r > height - 50) {
      this.vy -= wallPushStrength * ((this.y + this.r) - (height - 50));  // Push from bottom wall
    }
  }

  // Calculate and return the speed of the shape
  getSpeed() {
    return sqrt(this.vx * this.vx + this.vy * this.vy);
  }
}

// Special class for the blinking blasting ball
class BlastingBall {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 80;  // Big radius
    this.active = true;  // Ball is initially active
  }

  draw() {
    if (this.active) {
      noFill();
      stroke(0, 255, 255);  // Cyan outline in HSB color mode
      strokeWeight(3);
      ellipse(this.x, this.y, this.r * 2);  // Draw the blasting ball
    }
  }

  blast() {
    if (!this.active) return;  // Prevent double blast

    // Array to keep track of shapes to remove (those that break)
    let shapesToRemove = [];
    let newShapes = []; // Store new smaller shapes

    // Boost velocities of all shapes
    for (let shape of shapes) {
      let dx = shape.x - this.x;
      let dy = shape.y - this.y;
      let dist = sqrt(dx * dx + dy * dy);

      // Apply blast force inversely proportional to distance
      if (dist < 200) {  // Only affect nearby objects
        let boostFactor = 15 / dist;  // Larger boost for closer objects

        // Decide randomly whether to break the shape (e.g., 50% chance)
        if (random(1) < 0.5 && shape.size > 20) {
          // Break the shape into smaller pieces
          let numPieces = floor(random(2, 5)); // Break into 2 to 4 pieces
          let pieceMass = shape.m / numPieces;
          let pieceSize = shape.size / sqrt(numPieces); // Adjust size

          for (let i = 0; i < numPieces; i++) {
            // Slight random offset for position
            let offsetX = random(-shape.r, shape.r);
            let offsetY = random(-shape.r, shape.r);

            // New velocities influenced by the blast
            let newVx = shape.vx + boostFactor * (dx + random(-1, 1));
            let newVy = shape.vy + boostFactor * (dy + random(-1, 1));

            // Create new smaller shape
            let newShape = new Shape(
              shape.x + offsetX,
              shape.y + offsetY,
              newVx,
              newVy,
              pieceMass,
              shape.type,
              pieceSize
            );

            if (energyTransferEnabled) newShape.changeColorBasedOnSpeed();

            newShapes.push(newShape);
          }

          // Mark the original shape for removal
          shapesToRemove.push(shape);
        } else {
          // Apply blast force to the shape
          shape.vx += boostFactor * dx;
          shape.vy += boostFactor * dy;
          if (energyTransferEnabled) shape.changeColorBasedOnSpeed();
        }
      }
    }

    // Remove shapes that were broken
    for (let shape of shapesToRemove) {
      let index = shapes.indexOf(shape);
      if (index > -1) {
        shapes.splice(index, 1);
      }
    }

    // Add new smaller shapes to the main shapes array
    shapes = shapes.concat(newShapes);

    // Mark the blast as active, and deactivate the ball after blast
    blastActive = true;
    this.active = false;  // Deactivate the blasting ball

    setTimeout(() => {
      blastActive = false;  // Turn off the blast effect after 1 second
    }, 1000);
  }
}

function checkCollision(shape1, shape2) {
  // Collision detection between two shapes
  let dx = shape2.x - shape1.x;
  let dy = shape2.y - shape1.y;
  let dist = sqrt(dx * dx + dy * dy);
  return dist < shape1.r + shape2.r;
}

function resolveCollision(shape1, shape2) {
  let dx = shape2.x - shape1.x;
  let dy = shape2.y - shape1.y;
  let dist = sqrt(dx * dx + dy * dy);

  let nx = dx / dist;
  let ny = dy / dist;

  // Calculate relative velocity
  let relVelX = shape2.vx - shape1.vx;
  let relVelY = shape2.vy - shape1.vy;

  // Velocity along the normal (line connecting centers)
  let velAlongNormal = relVelX * nx + relVelY * ny;

  // Do not resolve if velocities are separating
  if (velAlongNormal > 0) {
    return;
  }

  // Set restitution (elasticity) based on shape type
  let restitution = 0.9;  // Default restitution
  if (shape1.type === 'circle' || shape2.type === 'circle') {
    restitution = 1.1;  // Circles bounce a little faster
  }

  // Calculate impulse scalar
  let impulse = (-(1 + restitution) * velAlongNormal) / (1 / shape1.m + 1 / shape2.m);

  // Apply impulse to both objects
  let impulseX = impulse * nx;
  let impulseY = impulse * ny;

  shape1.vx -= impulseX / shape1.m;
  shape1.vy -= impulseY / shape1.m;
  shape2.vx += impulseX / shape2.m;
  shape2.vy += impulseY / shape2.m;

  // Change color based on speed for both shapes (if energy transfer is enabled)
  if (energyTransferEnabled) {
    shape1.changeColorBasedOnSpeed();
    shape2.changeColorBasedOnSpeed();
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 255, 255);  // Set color mode to HSB for beautiful color patterns

  resetShapes();  // Initialize with some random shapes

  // Create the controls panel
  let controlsPanel = createDiv().id('controls-panel');

  // Now create the controls inside the panel
  // Button to toggle gravity on and off
  let gravityButton = createButton('Toggle Gravity').parent(controlsPanel);
  gravityButton.mousePressed(() => {
    gravityEnabled = !gravityEnabled;  // Toggle gravity on or off
    gravityButton.style('background-color', gravityEnabled ? 'green' : '');  // Highlight green when active
  });

  // Button to toggle energy transfer mode
  let energyButton = createButton('Energy Transfer Mode').parent(controlsPanel);
  energyButton.mousePressed(() => {
    energyTransferEnabled = !energyTransferEnabled;  // Toggle energy transfer on or off
    energyButton.style('background-color', energyTransferEnabled ? 'green' : '');  // Highlight green when active
  });

  // Button to toggle wall push mode
  let wallPushButton = createButton('Wall Push Mode').parent(controlsPanel);
  wallPushButton.mousePressed(() => {
    wallPushEnabled = !wallPushEnabled;  // Toggle wall push mode on or off
    wallPushButton.style('background-color', wallPushEnabled ? 'green' : '');  // Highlight green when active
  });

  // Button to toggle trails on and off
  let trailsButton = createButton('Toggle Trails').parent(controlsPanel);
  trailsButton.mousePressed(() => {
    trailsEnabled = !trailsEnabled;  // Toggle trails on or off
    trailsButton.style('background-color', trailsEnabled ? 'green' : '');  // Highlight green when active
  });

  // Button to toggle annotations on and off
  let annotationsButton = createButton('Toggle Annotations').parent(controlsPanel);
  annotationsButton.mousePressed(() => {
    annotationsEnabled = !annotationsEnabled;  // Toggle annotations on or off
    annotationsButton.style('background-color', annotationsEnabled ? 'green' : '');  // Highlight green when active
  });

  // Button to trigger the blast after 3 seconds
  let blastButton = createButton('Big Boom Incoming!').parent(controlsPanel);
  blastButton.mousePressed(() => {
    let blastX = random(100, width - 100);  // Randomize blast position
    let blastY = random(100, height - 100);
    blastingBall = new BlastingBall(blastX, blastY);  // Set new blasting ball

    // Start the blinking effect for 3 seconds before the blast
    let interval = setInterval(() => {
      blinkState = !blinkState;  // Toggle blink state
    }, 300);  // Blink every 0.3 seconds

    setTimeout(() => {
      if (blastingBall) {
        blastingBall.blast();  // Blast after countdown
        clearInterval(interval);  // Clear the blink timer
      }
    }, 3000);  // Wait 3 seconds before the blast
  });

  // Toggle button to start adding random objects every 30 seconds
  let addShapeButton = createButton('Add Random Objects').parent(controlsPanel);
  addShapeButton.mousePressed(() => {
    addObjectsEnabled = !addObjectsEnabled;
    addShapeButton.style('background-color', addObjectsEnabled ? 'green' : '');

    if (addObjectsEnabled) {
      addObjectsInterval = setInterval(() => {
        addMultipleRandomShapes(5);
      }, 30000);  // Add 5 random shapes every 30 seconds
    } else {
      clearInterval(addObjectsInterval);  // Stop adding objects
    }
  });

  // Reset button to clear and reinitialize the system
  let resetButton = createButton('Reset').parent(controlsPanel);
  resetButton.mousePressed(() => {
    resetShapes();  // Reset the system
  });

  // Fullscreen toggle button
  let fullscreenButton = createButton('Toggle Fullscreen').parent(controlsPanel);
  fullscreenButton.mousePressed(() => {
    let fs = fullscreen();
    fullscreen(!fs);
    isFullscreen = !fs;
    fullscreenButton.style('background-color', isFullscreen ? 'green' : '');
  });

  // Slider to control the overall speed of objects
  let speedLabel = createSpan('Increase Speed').parent(controlsPanel).style('padding-right', '10px');
  let speedSlider = createSlider(1, 10, defaultVelocityCap).parent(controlsPanel);
  speedSlider.input(() => {
    velocityCap = speedSlider.value();  // Update velocity cap based on slider
  });

  // Create the toggle arrow
  let toggleArrow = createDiv('&laquo;').id('toggle-arrow');
  toggleArrow.mousePressed(() => {
    let controlsPanel = select('#controls-panel');
    if (controlsPanel.hasClass('visible')) {
      controlsPanel.removeClass('visible');
      toggleArrow.html('&laquo;'); // Left-pointing arrow when panel is hidden
    } else {
      controlsPanel.addClass('visible');
      toggleArrow.html('&raquo;'); // Right-pointing arrow when panel is visible
    }
  });
}

function resetShapes() {
  shapes = [];
  for (let i = 0; i < 5; i++) {
    addRandomShape();
  }
}

function addRandomShape() {
  let types = ['circle', 'square', 'triangle', 'star'];  // Possible shapes
  let randomType = random(types);

  // Random initial position and velocity with some variation in speed
  let x = random(50, width - 50);
  let y = random(50, height - 50);
  let vx = random(-2, 2);
  let vy = random(-2, 2);
  let m = random(1, 3);

  // Add new shape to the shapes array
  shapes.push(new Shape(x, y, vx, vy, m, randomType));
}

function addMultipleRandomShapes(count) {
  for (let i = 0; i < count; i++) {
    addRandomShape();
  }
}

// Function to remove a percentage of objects from the system
function removePercentageOfObjects(percentage) {
  let numToRemove = floor(shapes.length * percentage);
  for (let i = 0; i < numToRemove; i++) {
    shapes.splice(floor(random(shapes.length)), 1);  // Randomly remove objects
  }
}

// Function to add a circle based on hold duration
function addCircle(x, y, size) {
  let vx = random(-2, 2);
  let vy = random(-2, 2);
  let m = map(size, 20, 100, 1, 5); // Mass proportional to size
  shapes.push(new Shape(x, y, vx, vy, m, 'circle', size));
}

function draw() {
  background(255);

  // Move and draw shapes
  for (let shape of shapes) {
    shape.move();
    shape.draw();
  }

  // Check collisions between shapes
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      if (checkCollision(shapes[i], shapes[j])) {
        resolveCollision(shapes[i], shapes[j]);
      }
    }
  }

  // Draw and manage the blasting ball
  if (blastingBall && blastingBall.active) {
    blastingBall.draw();
  }

  // If mouse is being held down, display a growing circle
  if (isHolding && mouseHoldPosition) {
    let holdDuration = millis() - holdStartTime;
    let size = map(holdDuration, 0, 2000, 20, 100);
    size = constrain(size, 20, 100);
    noFill();
    stroke(0);
    ellipse(mouseHoldPosition.x, mouseHoldPosition.y, size);
  }
}

function mousePressed() {
  // Start tracking when mouse is pressed
  isHolding = true;
  holdStartTime = millis(); // Record the current time in milliseconds
  mouseHoldPosition = createVector(mouseX, mouseY); // Record the position
}

function mouseReleased() {
  if (isHolding) {
    // Calculate hold duration
    let holdDuration = millis() - holdStartTime; // Duration in milliseconds

    // Map the hold duration to a reasonable size
    let size = map(holdDuration, 0, 2000, 20, 100); // Hold up to 2 seconds
    size = constrain(size, 20, 100); // Ensure size stays within limits

    // Create a new circle at the position with calculated size
    addCircle(mouseHoldPosition.x, mouseHoldPosition.y, size);

    // Reset holding variables
    isHolding = false;
    mouseHoldPosition = null;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
