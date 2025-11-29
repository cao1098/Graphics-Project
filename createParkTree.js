let initial_length,
    initial_radius,
    angleToUse,
	rules;
var iterations;

// 
// initialize grammar variables
//
function initializeGrammarVars() {
    // how to set line width?????
    // these will get randomized
    initial_radius = 5.0;
    rules = [];
}

function isNumeric(char) {
	return /^[0-9]$/.test(char);
}

// Run the lsystem iterations number of times on the start axiom.
function run(iterations, startString) {
	let grammarArray = startString.split('');
    let doubleBuffer = [];

	console.log("iterations: " + iterations);
    for (let i = 0; i < iterations; i++) {
		for (let j = 0; j < grammarArray.length; j++) {
            if (isNumeric(grammarArray[j])) {
				let rule = rules[parseInt(grammarArray[j])].split('');
				if (doubleBuffer.length === 0) {
					doubleBuffer = rule;
				} else {
					doubleBuffer = doubleBuffer.concat(rule);
                }
			} else {
				if (doubleBuffer.length === 0) {
					doubleBuffer = grammarArray[j];
				} else {
					doubleBuffer = doubleBuffer.concat(grammarArray[j]);
				}
            }
           
		}
		
		grammarArray.length = 0; // Clear
		grammarArray.push(...doubleBuffer); 
		doubleBuffer.length = 0;
    }

    return grammarArray;
}

//
// l-system grammar creation code
// 
function createGrammar() {
    //variables : 0, 1
    //constants: [, ]
    //axiom  : 0
    //rules  : (1 ? 11), (0 ? 1[0]0)
    // Second example LSystem from 
    // http://en.wikipedia.org/wiki/L-system
    let start = "0";
    rules[0] = "1[0]0";
    rules[1] = "11";

	let grammar = run(iterations, start);
	return grammar;
}

//
// l-system drawing code
//
function drawGrammarPoints(grammarArray, angleToUse) {
  //set angle to use here

	// to push and pop location and angle
	let positions = [];
	let angles = [];

    // current angle and position
	let angle = 0.0;

	// positions to draw towards
	let newPosition = [];
	let rotated = [];

	// always start at 0.0, 0.0, 0.25
	let position = [0.0, 0.0, 0.25];
	let posx=0.0, posy = 0.0;
	
	// Apply the drawing rules to the string given to us
	for (let i = 0; i < grammarArray.length; i++) {
		let buff = grammarArray[i];
		switch (buff) {
			case '0':
				// draw a line ending in a leaf
				posy += initial_length;
				newPosition = [position[0], posy, position[2]];
				rotated = rotate(position, newPosition, angle);
				newPosition = [rotated[0], rotated[1], position[2]];
				addLine(position, newPosition);

				// set up for the next draw
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];
        drawLeaf(position);
        
				break;
			case '1':
				// draw a line 
				posy += initial_length;
				newPosition = [position[0],posy, position[2]];
				rotated = rotate(position, newPosition, angle);
				newPosition = [rotated[0], rotated[1], position[2]];
				addLine(position, newPosition);

				// set up for the next draw
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];
				break;
			case '[':
				//[: push position and angle, turn left angleToUse degrees
				positions.push(posy);
				positions.push(posx);
				angles.push(angle);
				angle -= angleToUse;
				break;
			case ']':
				//]: pop position and angle, turn right angleToUse degrees
				posx = positions.pop();
				posy = positions.pop();
				position = [posx, posy, position[2]];
				angle = angles.pop();
				angle += angleToUse;
				break;
			default:break;
		}
	}
}

function drawLeaf(position){
  // Select amount of leaves to draw
  // for each leaf pick a random size and a random angle to draw it at
  // making size smaller for smaller iterations might be good too
  for(let i = 0; i <= 10; i++){
    let leafAngle = Math.floor(Math.random() * 360);
    let leafSize = Math.random() * 0.15;
    console.log("Drawing a leaf");
    // Generate triangle size
    length = 0.025;
    let p1 = [position[0], position[1], position[2]];
    let p2 = [position[0] - leafSize/2, position[1] + leafSize, position[2]];
    let p3 = [position[0] + leafSize/2, position[1] + leafSize, position[2]];

    p2 = rotate(p1, p2, leafAngle);
    p3 = rotate(p1, p3, leafAngle);
    leafPoints.push(
      // Triangle ABC
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p1[2],
      p3[0], p3[1], p1[2]
  );
  }
  
}

////////////////////////////////////////////////////////////////////
//
//  Utility functions
//
///////////////////////////////////////////////////////////////////

function radians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}
// rotate a line and return the position after rotation
// Assumes rotation around the Z axis
function rotate(pivotPoint, pointToRotate, angle) {
   		let Nx = (pointToRotate[0] - pivotPoint[0]);
   		let Ny = (pointToRotate[1] - pivotPoint[1]);
		let radAngle = radians(-angle);
	let result = [Math.cos(radAngle) * Nx - Math.sin(radAngle) * Ny + pivotPoint[0],
		Math.sin(radAngle) * Nx + Math.cos(radAngle) * Ny + pivotPoint[1]];
		return result;
}

function addLine(firstPosition, secondPosition) {
   
    // push first vertex
	points.push(firstPosition[0]); 
	points.push(firstPosition[1]);  
	points.push(firstPosition[2]);  
    
    // push second vertex
    points.push(secondPosition[0]); 
	points.push(secondPosition[1]);
	points.push(secondPosition[2]);
}