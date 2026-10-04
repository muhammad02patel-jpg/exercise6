/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://raw.githubusercontent.com/NCSUCGClassPrivate/exercise5/async/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://raw.githubusercontent.com/NCSUCGClassPrivate/exercise5/async/ellipsoids.json"; // ellipsoids file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* input globals */
var inputTriangles; // the triangles read in from json
var numTriangleSets = 0; // the number of sets of triangles
var triSetSizes = []; // the number of triangles in each set

/* webGL globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffers = []; // this contains vertex coordinates in triples, organized by tri set
var triangleBuffers = []; // this contains indices into vertexBuffers in triples, organized by tri set
var vertexPositionAttrib; // where to put position for vertex shader
var modelMatrixULoc; // where to put the model matrix for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try

    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file


// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch(e) {
        console.log(e);
    } // end catch

} // end setupWebGL


// read triangles in, load them into webgl buffers
function loadTriangles() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd; // vtx coords to add to the coord array
        var triToAdd; // tri indices to add to the index array

        // for each set of tris in the input file
        numTriangleSets = inputTriangles.length;
        for (var whichSet=0; whichSet<numTriangleSets; whichSet++) {

            // set up the vertex coord array
            inputTriangles[whichSet].coordArray = []; // create a list of coords for this tri set
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                inputTriangles[whichSet].coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
            } // end for vertices in set

            // send the vertex coords to webGL
            vertexBuffers[whichSet] = gl.createBuffer(); // init empty vertex coord buffer for current set
            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].coordArray),gl.STATIC_DRAW); // coords to that buffer

            // set up the triangle index array
            inputTriangles[whichSet].indexArray = []; // create a list of tri indices for this tri set
            triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length;
            for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                triToAdd = inputTriangles[whichSet].triangles[whichSetTri];
                inputTriangles[whichSet].indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
            } // end for triangles in set

            // send the triangle indices to webGL
            triangleBuffers[whichSet] = gl.createBuffer(); // init empty triangle index buffer for current tri set
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].indexArray),gl.STATIC_DRAW); // indices to that buffer
        } // end for each triangle set
    } // end if triangles found
} // end load triangles


// setup the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        void main(void) {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        uniform mat4 uModelMatrix;

        void main(void) {
            gl_Position = uModelMatrix * vec4(vertexPosition, 1.0);
        }
    `;

    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fShader,fShaderCode);
        gl.compileShader(fShader);

        var vShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vShader,vShaderCode);
        gl.compileShader(vShader);

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
        } else {
            var shaderProgram = gl.createProgram();

            gl.attachShader(shaderProgram, fShader);
            gl.attachShader(shaderProgram, vShader);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else {
                gl.useProgram(shaderProgram);

                vertexPositionAttrib =
                    gl.getAttribLocation(shaderProgram, "vertexPosition");

                modelMatrixULoc =
                    gl.getUniformLocation(shaderProgram, "uModelMatrix");

                gl.enableVertexAttribArray(vertexPositionAttrib);
            }
        }
    }

    catch(e) {
        console.log(e);
    }
} // end setup shaders


// render the loaded model
function renderTriangles() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // FIRST TRIANGLE
    // Rotate 90 degrees about its center
    inputTriangles[0].mMatrix = mat4.create();

    var setCenter = vec3.fromValues(.25,.75,0);

    // Move triangle to origin
    mat4.fromTranslation(
        inputTriangles[0].mMatrix,
        vec3.negate(vec3.create(),setCenter)
    );

    // Rotate 90 degrees
    mat4.multiply(
        inputTriangles[0].mMatrix,
        mat4.fromRotation(
            mat4.create(),
            Math.PI/2,
            vec3.fromValues(0,0,1)
        ),
        inputTriangles[0].mMatrix
    );

    // Move triangle back
    mat4.multiply(
        inputTriangles[0].mMatrix,
        mat4.fromTranslation(mat4.create(),setCenter),
        inputTriangles[0].mMatrix
    );


    // SECOND SHAPE
    // Scale diamond by 2 about its center
    // define the modeling matrix for the second set
    inputTriangles[1].mMatrix = mat4.create();
    var setCenter = vec3.fromValues(.25,.25,0);
    
    mat4.fromTranslation(inputTriangles[1].mMatrix,
                         vec3.negate(vec3.create(),setCenter));
    
    mat4.multiply(inputTriangles[1].mMatrix,
                  mat4.fromRotation(mat4.create(),Math.PI/4,vec3.fromValues(0,0,1)),
                  inputTriangles[1].mMatrix);
    
    mat4.multiply(inputTriangles[1].mMatrix,
                  mat4.fromTranslation(mat4.create(),setCenter),
                  inputTriangles[1].mMatrix);

    var diamondCenter = vec3.fromValues(.5,.25,0);

    // Move diamond to origin
    mat4.fromTranslation(
        inputTriangles[1].mMatrix,
        vec3.negate(vec3.create(),diamondCenter)
    );

    // Scale by 2
    mat4.multiply(
        inputTriangles[1].mMatrix,
        mat4.fromScaling(
            mat4.create(),
            vec3.fromValues(2,2,1)
        ),
        inputTriangles[1].mMatrix
    );

    // Move diamond back
    mat4.multiply(
        inputTriangles[1].mMatrix,
        mat4.fromTranslation(mat4.create(),diamondCenter),
        inputTriangles[1].mMatrix
    );


    // DRAW BOTH TRIANGLE SETS
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {

        gl.uniformMatrix4fv(
            modelMatrixULoc,
            false,
            inputTriangles[whichTriSet].mMatrix
        );

        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            vertexBuffers[whichTriSet]
        );

        gl.vertexAttribPointer(
            vertexPositionAttrib,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.bindBuffer(
            gl.ELEMENT_ARRAY_BUFFER,
            triangleBuffers[whichTriSet]
        );

        gl.drawElements(
            gl.TRIANGLES,
            3*triSetSizes[whichTriSet],
            gl.UNSIGNED_SHORT,
            0
        );
    }
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {

    setupWebGL();
    loadTriangles();
    setupShaders();
    renderTriangles();

} // end main
