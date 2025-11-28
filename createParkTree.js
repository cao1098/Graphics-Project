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