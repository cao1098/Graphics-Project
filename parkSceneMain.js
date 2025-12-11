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
    waterPoints,
    groundArr,
    groundPipeline,
    waterPipeline,
    textureData,
    uvs,
    uvsGround,
    bary,
    indices;
  
  // buffers
  let myVertexBuffer = null;
  let myLeafBuffer = null;
  let myGroundBuffer = null;
  let myWaterBuffer = null;
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


  async function createGround(iterations=3) {
    groundArr = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ];

    let water_start = Math.floor(Math.random() * 25);
    let rand_x = Math.floor(water_start / 5);
    let rand_y = water_start % 5;
    groundArr[rand_x][rand_y] = 1;

    let newGroundArr = [...groundArr];
    for (let iter = 0; iter < iterations; iter++) {
        for (let x = 0; x < groundArr.length; x++) {
            for (let y = 0; y < groundArr.length; y++) {
                if (groundArr[x][y] == 1)
                    continue;

                let factor = 0.01;

                if (x - 1 >= 0 && groundArr[x-1][y] == 1) {
                    factor += 0.25;
                }
    
                if (x + 1 < groundArr.length && groundArr[x+1][y] == 1) {
                    factor += 0.25;
                }
    
                if (y - 1 >= 0 && groundArr[x][y-1] == 1) {
                    factor += 0.25;
                }

                if (y + 1 < groundArr.length && groundArr[x][y+1] == 1) {
                    factor += 0.25;
                }

                factor += Math.random();

                if (factor >= 1)
                    newGroundArr[x][y] = 1;
            }
        }
        groundArr = newGroundArr;
    }
  }


  async function createParkScene() {

    // Call the functions in an appropriate order
    setShaderInfo();

    // clear your points and elements
    points = [];
    leafPoints = [];
    groundPoints = [];
    waterPoints = [];
    indices = [];
    bary = [];

    createGround();

    for (let x = 0; x < groundArr.length; x++) {
        for (let y = 0; y < groundArr.length; y++) {
            addTriangle(
                (x*0.5) + -1.25, 0, (y*0.5) + -1.25,   
                (x*0.5) + -1.25, 0, (y*0.5) + -0.75,   
                (x*0.5) + -0.75, 0, (y*0.5) + -1.25,
                groundArr[x][y] == 1 ? waterPoints : groundPoints);
            addTriangle(   
                (x*0.5) + -0.75, 0, (y*0.5) + -1.25,
                (x*0.5) + -1.25, 0, (y*0.5) + -0.75,
                (x*0.5) + -0.75, 0, (y*0.5) + -0.75,
                groundArr[x][y] == 1 ? waterPoints : groundPoints);
        }
    }

    const uvsGroundTemplate = [
        0.0, 0.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
    ];
    uvsGround = [];
    for (let x = 0; x < groundArr.length; x++) {
        for (let y = 0; y < groundArr.length; y++) {
            if (groundArr[x][y] == 0)
                uvsGround.push(...uvsGroundTemplate);
        }
    }
    
    // make lsystem
    let grammar = createGrammar(iterations);
    let treeCount = Math.floor(Math.random() * 5) + 1;
    let leafPos = 0;
    let treePos = 0;
    for(let t = 0; t < treeCount; t++){
        iterations = Math.floor(Math.random() * 5) + 1;
        angleToUse = Math.floor(Math.random() * 51) + 5;
        initial_length = Math.random() * 0.25 + 0.05;
        let xOffset = Math.random() * 2 - 1;
        let zOffset = Math.random() * 2 - 1;
        drawGrammarPoints(grammar, angleToUse, initial_length);
        for (let i = treePos; i < points.length; i += 3) {
            points[i] += xOffset;    // translate X
            points[i+2] += zOffset;  // translate Z
        }
        for (let i = leafPos; i < leafPoints.length; i += 3) {
            leafPoints[i] += xOffset;    // translate X
            leafPoints[i+2] += zOffset;  // translate Z
        }
        leafPos = leafPoints.length;
        treePos = points.length;   
    }

    // BUSH CODE
    let bushCount = Math.floor(Math.random() * 2) + 1;
    for(let t = 0; t < bushCount; t++){
        iterations = 2;
        angleToUse = Math.floor(Math.random() * 51) + 5;
        initial_length = Math.random() * 0 + 0.05;
        let xOffset = Math.random() * 2 - 1;
        let zOffset = Math.random() * 2 - 1;
        drawGrammarPoints(grammar, angleToUse, initial_length);
        for (let i = treePos; i < points.length; i += 3) {
            points[i] += xOffset;    // translate X
            points[i+2] += zOffset;  // translate Z
        }
        for (let i = leafPos; i < leafPoints.length; i += 3) {
            leafPoints[i] += xOffset;    // translate X
            leafPoints[i+2] += zOffset;  // translate Z
        }
        leafPos = leafPoints.length;
        treePos = points.length;   
    }
    

    uvs = new Float32Array(leafPoints.length / 3 * 2);
    for (let i = 0; i < uvs.length; i+=8) {
        uvs[i] = 0.0;
        uvs[i+1] = 0.0;
        uvs[i+2] = 0.0;
        uvs[i+3] = 1.0;
        uvs[i+4] = 1.0;
        uvs[i+5] = 1.0;
        uvs[i+6] = 1.0;
        uvs[i+7] = 0.0;
    }

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
    const waterBufferDesc = {
        size: waterPoints.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };

    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    myLeafBuffer = device.createBuffer(leafBufferDesc);
    myGroundBuffer = device.createBuffer(groundBufferDesc);
    myWaterBuffer = device.createBuffer(waterBufferDesc);

    let leafWriteArray = new Float32Array(myLeafBuffer.getMappedRange()); 
    let groundWriteArray = new Float32Array(myGroundBuffer.getMappedRange());
    let waterWriteArray = new Float32Array(myWaterBuffer.getMappedRange());
    let writeArray =
        new Float32Array(myVertexBuffer.getMappedRange());

    writeArray.set(points); // this copies the buffer
    leafWriteArray.set(leafPoints);
    groundWriteArray.set(groundPoints);
    waterWriteArray.set(waterPoints);

    myLeafBuffer.unmap();
    myVertexBuffer.unmap();
    myGroundBuffer.unmap();
    myWaterBuffer.unmap();

    // set up the uv buffer
    const uvAttribDesc = {
        shaderLocation: 1, // @location(1) in vertex shader
        offset: 0,
        format: 'float32x2' // 2 floats: u,v
    };

    const uvBufferLayoutDesc = {
        attributes: [uvAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 2, // sizeof(float) * 2 floats
        stepMode: 'vertex'
    };

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

    // create and bind bary buffer
    const baryAttribDesc = {
        shaderLocation: 1, // @location(1) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: x,y,z
    };

    const myBaryBufferLayoutDesc = {
        attributes: [baryAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3, // 3 bary's
        stepMode: 'vertex'
    };

    const myBaryBufferDesc = {
        size: bary.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };

    myBaryBuffer = device.createBuffer(myBaryBufferDesc);
    let writeBaryArray =
        new Float32Array(myBaryBuffer.getMappedRange());

    writeBaryArray.set(bary); 
    myBaryBuffer.unmap();

    // set up index buffer
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

    writeIndexArray.set(indices); 
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
            frontFace: 'cw', 
            cullMode: 'none'
        }
    };

    const waterPipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc, uvBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main4',
            targets: [colorState]
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        primitive: {
            topology: 'triangle-list',  
            frontFace: 'cw', 
            cullMode: 'none'
        }
    };

    pipeline = device.createRenderPipeline(pipelineDesc);
    leafPipeline = device.createRenderPipeline(leafPipelineDesc);
    groundPipeline = device.createRenderPipeline(groundPipelineDesc);
    waterPipeline = device.createRenderPipeline(waterPipelineDesc);

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

    // trunk texture
    const kTextureWidth = 1;
    const kTextureHeight = 1;
    const l = [150, 75, 0, 255];  // brown

    textureData = new Uint8Array([l].flat());
    
    let texture_trunk = device.createTexture({
            size: [kTextureWidth, kTextureHeight],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

    device.queue.writeTexture(
            { texture: texture_trunk },
            textureData,
            { bytesPerRow: kTextureWidth * 4 },
            { width: kTextureWidth, height: kTextureHeight },
    );

    // leaf texture
    const url_leaf = './leaf_texture.jpg';
    let imageSource = await loadImageBitmap(url_leaf);
    let texture_leaf = device.createTexture({
        label: "image",
        format: 'rgba8unorm',
        size: [imageSource.width, imageSource.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageSource, flipY: true },
        { texture: texture_leaf },
        { width: imageSource.width, height: imageSource.height, depthOrArrayLayers: 1 },
    );

    // ground texture
    const url_ground = './ground_texture.jpg';
    let imageSource3 = await loadImageBitmap(url_ground);
    let texture_ground = device.createTexture({
        label: "image",
        format: 'rgba8unorm',
        size: [imageSource3.width, imageSource3.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageSource3, flipY: true },
        { texture: texture_ground },
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
                { binding: 2, resource: texture_trunk.createView() },
                { binding: 3, resource: texture_leaf.createView() },
                { binding: 4, resource: texture_ground.createView() },
            ]
        });

    // indicate a redraw is required.
    updateDisplay = true;
}
// test

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
    
    // draw leaves first
    passEncoder.setPipeline(leafPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myLeafBuffer);
    passEncoder.setVertexBuffer(1, myUvBuffer);
    passEncoder.draw(leafPoints.length / 3);

    // then trunk
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.draw(points.length/3);

    // then ground
    passEncoder.setPipeline(groundPipeline);
    passEncoder.setVertexBuffer(0, myGroundBuffer);
    passEncoder.setVertexBuffer(1, myBaryBuffer);
    passEncoder.setVertexBuffer(1, myUvGroundBuffer);
    passEncoder.setIndexBuffer(myIndexBuffer, "uint16");
    passEncoder.drawIndexed(indices.length, 1);

    // then water
    passEncoder.setPipeline(waterPipeline);
    passEncoder.setVertexBuffer(0, myWaterBuffer);
    passEncoder.draw(waterPoints.length/3);

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

function addTriangle (x0,y0,z0,x1,y1,z1,x2,y2,z2,arr) {

    
    var nverts = arr.length / 3;
    
    // push first vertex
    arr.push(x0);  bary.push (1.0);
    arr.push(y0);  bary.push (0.0);
    arr.push(z0);  bary.push (0.0);
    indices.push(nverts);
    nverts++;
    
    // push second vertex
    arr.push(x1); bary.push (0.0);
    arr.push(y1); bary.push (1.0);
    arr.push(z1); bary.push (0.0);
    indices.push(nverts);
    nverts++
    
    // push third vertex
    arr.push(x2); bary.push (0.0);
    arr.push(y2); bary.push (0.0);
    arr.push(z2); bary.push (1.0);
    indices.push(nverts);
    nverts++;
}