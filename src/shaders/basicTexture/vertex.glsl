
varying vec2 vUv;
// Transformation described here: https://stackoverflow.com/questions/29879216/preparing-model-view-and-projection-matrices-for-glsl
// Variables described here: https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)
void main() {
    vec4 objectPos = vec4(position, 1.);
    // Moves it into world space.
    vec4 worldPos = modelMatrix * objectPos;
    // Applies view (moves it relative to camera position/orientation)
    vec4 viewPos = viewMatrix * worldPos;
    // Applies projection (orthographic/perspective)
    vec4 projectionPos = projectionMatrix * viewPos;
    gl_Position = projectionPos;
    vUv = uv; // add this line
}