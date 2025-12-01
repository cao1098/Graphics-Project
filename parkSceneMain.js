  'use strict';

  // Global variables that are set and used
  // across the application
let verticesSize,
    vertices,
    adapter,
    context,
    colorAttachment,
    colorTextureView,
    colorTexture,
    depthTexture,
    code,
    computeCode,
    shaderDesc,
    colorState,
    shaderModule,
    pipeline,
    renderPassDesc,
    commandEncoder,
    passEncoder,
    device,
    drawingTop,
    drawingLeft,
    canvas,
    points,
    leafPoints,
    uniformValues,
    uniformBindGroup,
    leafPipeline,
    groundPoints,
    groundPipeline;
  
  // buffers
  let myVertexBuffer = null;
  let myLeafBuffer = null;
  let myGroundBuffer = null;
  let uniformBuffer;

  // Other globals with default values
  var updateDisplay = true;
  var anglesReset = [0.0, 0.0, 0.0];
  var angles = [0.0, 0.0, 0.0];
  var angleInc = 5.0;
  var scaleReset = 0.5;
  var scale = 0.5;
  var scaleInc = 0.8;
 
// set up the shader var's
function setShaderInfo() {
    // set up the shader code var's
    code = document.getElementById('shader').innerText;
    shaderDesc = { code: code };
    shaderModule = device.createShaderModule(shaderDesc);
    colorState = {
        format: 'bgra8unorm'
    };

    // set up depth
    // depth shading will be needed for 3d objects in the future
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
}

  // Create a program with the appropriate vertex and fragment shaders
  async function initProgram() {

      // Check to see if WebGPU can run
      if (!navigator.gpu) {
          console.error("WebGPU not supported on this browser.");
          return;
      }

      // get webgpu browser software layer for graphics device
      adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
          console.error("No appropriate GPUAdapter found.");
          return;
      }

      // get the instantiation of webgpu on this device
      device = await adapter.requestDevice();
      if (!device) {
          console.error("Failed to request Device.");
          return;
      }

      // configure the canvas
      context = canvas.getContext('webgpu');
      const canvasConfig = {
          device: device,
          // format is the pixel format
          format: navigator.gpu.getPreferredCanvasFormat(),
          // usage is set up for rendering to the canvas
          usage:
              GPUTextureUsage.RENDER_ATTACHMENT,
          alphaMode: 'opaque'
      };
      context.configure(canvasConfig);

  }

  // general call to make and bind a simple lsystem
  function createParkScene(){
    // STEP 0: The floor
    
    // STEP 1: Determine how many trees will be drawn
    // STEP 2: for each tree drawn, generate some random params for that tree, height, # branches, etc.

    // For now create one tree, w/ random params
    // Iterations can be between 1 and 7
    // Angle can be between 5 and 55
    // initial length between 0.1 and 0.5
    // trees will have a random assortment of triangles on the ends of the branches
    iterations = 3;
    angleToUse = 25;
    initial_length = 0.1;
    createTree(iterations);
    
  }


  function createTree(iterations) {

    // Call the functions in an appropriate order
    setShaderInfo();

    // clear your points and elements
    points = [];
    leafPoints = [];
    groundPoints = [
    -1, 0, -1,   
    -1, 0,  1,   
     1, 0, -1,   
    -1, 0,  1,   
     1, 0,  1,   
     1, 0, -1    
];

    // make lsystem
    let grammar = createGrammar(iterations);
    drawGrammarPoints(grammar, angleToUse, initial_length);

    // create and bind vertex and other buffers
    // set up the attribute we'll use for the vertices
    const vertexAttribDesc = {
        shaderLocation: 0, // @location(0) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: x,y,z
    };

    // this sets up our buffer layout
    const vertexBufferLayoutDesc = {
        attributes: [vertexAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3, // sizeof(float) * 3 floats
        stepMode: 'vertex'
    };

    // buffer layout and filling
    const vertexBufferDesc = {
        size: points.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    const leafBufferDesc = {
        size: leafPoints.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    const groundBufferDesc = {
        size: groundPoints.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };

    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    myLeafBuffer = device.createBuffer(leafBufferDesc);
    myGroundBuffer = device.createBuffer(groundBufferDesc);

    let leafWriteArray = new Float32Array(myLeafBuffer.getMappedRange()); 
    let groundWriteArray = new Float32Array(myGroundBuffer.getMappedRange());
    let writeArray =
        new Float32Array(myVertexBuffer.getMappedRange());

    writeArray.set(points); // this copies the buffer
    leafWriteArray.set(leafPoints);
    groundWriteArray.set(groundPoints);

    myLeafBuffer.unmap();
    myVertexBuffer.unmap();
    myGroundBuffer.unmap();

   
    // Set up the uniform var
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            }
        ]
    });

    // set up the pipeline layout
    const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);

    // pipeline desc
    const pipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        primitive: {
            topology: 'line-list',  
            frontFace: 'cw', // this doesn't matter for lines
            cullMode: 'back'
        }
    };

    const leafPipelineDesc = {
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayoutDesc]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [colorState]
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus'
      },
      primitive: {
        topology: 'triangle-list',
        frontFace: 'cw',
        cullMode: 'back'
      }
    };

    const groundPipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        primitive: {
            topology: 'triangle-list',  
            frontFace: 'cw', // this doesn't matter for lines
            cullMode: 'back'
        }
    };

    leafPipeline = device.createRenderPipeline(leafPipelineDesc);

    pipeline = device.createRenderPipeline(pipelineDesc);

    groundPipeline = device.createRenderPipeline(groundPipelineDesc);

    uniformValues = new Float32Array([0,0,0,0]);
    uniformValues[0] = angles[0];
    uniformValues[1] = angles[1];
    uniformValues[2] = angles[2];
    uniformValues[3] = scale;

    uniformBuffer = device.createBuffer({
        size: uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                },
            },
        ],
    });

    // indicate a redraw is required.
    updateDisplay = true;
}

// We call draw to render to our canvas
function draw() {
    
    // set up color info
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();

    // a color attachment ia like a buffer to hold color info
    colorAttachment = {
        view: colorTextureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
    };
    renderPassDesc = {
        colorAttachments: [colorAttachment],
        depthStencilAttachment: {
            view: depthTexture.createView(),

            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        },
    };

    // convert to radians before sending to shader
    uniformValues[0] = radians(angles[0]);
    uniformValues[1] = radians(angles[1]);
    uniformValues[2] = radians(angles[2]);
    uniformValues[3] = scale;

    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    // create the render pass
    commandEncoder = device.createCommandEncoder();
    passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
    passEncoder.setViewport(0, 0,canvas.width, canvas.height, 0, 1);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.draw(points.length/3);

    
    passEncoder.setPipeline(leafPipeline);
    passEncoder.setVertexBuffer(0, myLeafBuffer);
    passEncoder.draw(leafPoints.length / 3);

    passEncoder.setPipeline(groundPipeline);
    passEncoder.setVertexBuffer(0, myGroundBuffer);
    passEncoder.draw(groundPoints.length / 3);

    passEncoder.end();

    // submit the pass to the device
    device.queue.submit([commandEncoder.finish()]);
}


  // Entry point to our application
async function init() {
    // Retrieve the canvas
    canvas = document.querySelector("canvas");

    // deal with keypress
    window.addEventListener('keydown', gotKey, false);

    // Read, compile, and link your shaders
    await initProgram();
    initializeGrammarVars();
    // create and bind your current object
    createParkScene();

    // do a draw
    draw();
}
