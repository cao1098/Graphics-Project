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
    groundPipeline,
    textureData,
    uvs,
    uvsGround,
    bary,
    indices;
  
  // buffers
  let myVertexBuffer = null;
  let myLeafBuffer = null;
  let myGroundBuffer = null;
  let myBaryBuffer = null;
  let myIndexBuffer = null;
  let uniformBuffer;
  let myUvBuffer, myUvGroundBuffer;

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
  async function createParkScene(){
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
    await createTree(iterations);
    
  }


  async function createTree(iterations) {

    // Call the functions in an appropriate order
    setShaderInfo();

    // clear your points and elements
    points = [];
    leafPoints = [];
    groundPoints = [];
// Inline uvs
uvs = [
    // front
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    // back
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    // left
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    // right
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    // top
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    // bottom
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
];
uvs = new Float32Array(528);
for (let i = 0; i < 528; i+=8) {
    uvs[i] = 0.0;
    uvs[i+1] = 0.0;
    uvs[i+2] = 0.0;
    uvs[i+3] = 1.0;
    uvs[i+4] = 1.0;
    uvs[i+5] = 1.0;
    uvs[i+6] = 1.0;
    uvs[i+7] = 0.0;
}
uvsGround = [
    0.0, 0.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
];
    indices = [];
    bary = [];
    addTriangle(
        -0.25, 0, -0.25,   
        -0.25, 0,  0.25,   
        0.25, 0, -0.25);
    addTriangle(   
        0.25, 0, -0.25,
        -0.25, 0,  0.25,
        0.25, 0, 0.25  
        );
    

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

    // set up the uv buffer
    // set up the attribute we'll use for the vertices
    const uvAttribDesc = {
        shaderLocation: 1, // @location(1) in vertex shader
        offset: 0,
        format: 'float32x2' // 2 floats: u,v
    };

    // this sets up our buffer layout
    const uvBufferLayoutDesc = {
        attributes: [uvAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 2, // sizeof(float) * 2 floats
        stepMode: 'vertex'
    };

    // create and bind bary buffer
    const baryAttribDesc = {
        shaderLocation: 1, // @location(1) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: x,y,z
    };

    // this sets up our buffer layout
    const myBaryBufferLayoutDesc = {
        attributes: [baryAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3, // 3 bary's
        stepMode: 'vertex'
    };

    // buffer layout and filling
    const uvBufferDesc = {
        size: uvs.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myUvBuffer = device.createBuffer(uvBufferDesc);
    let writeArrayUvs =
        new Float32Array(myUvBuffer.getMappedRange());

    writeArrayUvs.set(uvs); // this copies the buffer
    myUvBuffer.unmap();

    const uvGroundBufferDesc = {
        size: uvsGround.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myUvGroundBuffer = device.createBuffer(uvGroundBufferDesc);
    let writeGroundArrayUvs =
        new Float32Array(myUvGroundBuffer.getMappedRange());

        writeGroundArrayUvs.set(uvsGround); // this copies the buffer
    myUvGroundBuffer.unmap();

    const myBaryBufferDesc = {
        size: bary.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };

    myBaryBuffer = device.createBuffer(myBaryBufferDesc);
    let writeBaryArray =
        new Float32Array(myBaryBuffer.getMappedRange());

    writeBaryArray.set(bary); // this copies the buffer
    myBaryBuffer.unmap();

    if (indices.length % 2 != 0) {
        indices.push(indices[indices.length-1]);
    }

    const myIndexBufferDesc = {
        size: indices.length * Uint16Array.BYTES_PER_ELEMENT,  
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };

    myIndexBuffer = device.createBuffer(myIndexBufferDesc);
    let writeIndexArray =
        new Uint16Array(myIndexBuffer.getMappedRange());

    writeIndexArray.set(indices); // this copies the buffer
    myIndexBuffer.unmap();

   
    // Set up the uniform var
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering",
                },
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            },
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            },
            {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
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
            buffers: [vertexBufferLayoutDesc, uvBufferLayoutDesc]
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
        buffers: [vertexBufferLayoutDesc, uvBufferLayoutDesc]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main2',
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
        cullMode: 'none'
      }
    };

    const groundPipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc, uvBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main3',
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
            cullMode: 'none'
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

    // texture creation 
    const kTextureWidth = 7;
    const kTextureHeight = 7;
    const g = [0, 128, 0, 255];  // green
    const l = [0, 255, 0, 255];  // white
    const b = [0, 0, 255, 255];  // blue

    textureData = new Uint8Array([
            l, l, l, l, l, l, l,
            l, g, g, g, g, g, l,
            l, g, g, g, g, g, l,
            l, g, g, g, g, g, l,
            l, g, g, g, g, g, l,
            l, g, g, g, g, g, l,
            l, l, l, l, l, l, l,
        ].flat());
    
    let texture = device.createTexture({
            size: [kTextureWidth, kTextureHeight],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

    device.queue.writeTexture(
            { texture },
            textureData,
            { bytesPerRow: kTextureWidth * 4 },
            { width: kTextureWidth, height: kTextureHeight },
    );

    // now create the texture to render
    const url = './leaf_texture.jpg';
    let imageSource = await loadImageBitmap(url);
    let texture2 = device.createTexture({
        label: "image",
        format: 'rgba8unorm',
        size: [imageSource.width, imageSource.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageSource, flipY: true },
        { texture: texture2 },
        { width: imageSource.width, height: imageSource.height, depthOrArrayLayers: 1 },
    );

    const url3 = './ground_texture.jpg';
    let imageSource3 = await loadImageBitmap(url3);
    let texture3 = device.createTexture({
        label: "image",
        format: 'rgba8unorm',
        size: [imageSource3.width, imageSource3.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageSource3, flipY: true },
        { texture: texture3 },
        { width: imageSource3.width, height: imageSource3.height, depthOrArrayLayers: 1 },
    );

    let samplerTex = device.createSampler();

    uniformBindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformBuffer,
                    }
                },
                { binding: 1, resource: samplerTex },
                { binding: 2, resource: texture.createView() },
                { binding: 3, resource: texture2.createView() },
                { binding: 4, resource: texture3.createView() },
            ]
        });

    // indicate a redraw is required.
    updateDisplay = true;
}

// function obtained from:
// https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html
async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
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
    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    
    passEncoder.setPipeline(leafPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myLeafBuffer);
    passEncoder.setVertexBuffer(1, myUvBuffer);
    passEncoder.draw(leafPoints.length / 3);

    console.log(groundPoints, uvs);

    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.draw(points.length/3);

    passEncoder.setPipeline(groundPipeline);
    passEncoder.setVertexBuffer(0, myGroundBuffer);
    passEncoder.setVertexBuffer(1, myBaryBuffer);
    passEncoder.setVertexBuffer(1, myUvGroundBuffer);
    passEncoder.setIndexBuffer(myIndexBuffer, "uint16");
    passEncoder.drawIndexed(indices.length, 1);
    //passEncoder.draw(groundPoints.length / 3);

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
    await createParkScene();

    // do a draw
    draw();
}

function addTriangle (x0,y0,z0,x1,y1,z1,x2,y2,z2) {

    
    var nverts = groundPoints.length / 3;
    
    // push first vertex
    groundPoints.push(x0);  bary.push (1.0);
    groundPoints.push(y0);  bary.push (0.0);
    groundPoints.push(z0);  bary.push (0.0);
    indices.push(nverts);
    nverts++;
    
    // push second vertex
    groundPoints.push(x1); bary.push (0.0);
    groundPoints.push(y1); bary.push (1.0);
    groundPoints.push(z1); bary.push (0.0);
    indices.push(nverts);
    nverts++
    
    // push third vertex
    groundPoints.push(x2); bary.push (0.0);
    groundPoints.push(y2); bary.push (0.0);
    groundPoints.push(z2); bary.push (1.0);
    indices.push(nverts);
    nverts++;
}