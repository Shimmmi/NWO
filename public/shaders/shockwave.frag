uniform float u_time;
uniform vec3  u_color;
uniform float u_thickness;
uniform float u_intensity;

varying vec2 vUv;

void main() {
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(vUv, center);

  float waveFront = u_time * 0.8;
  float wave = smoothstep(waveFront - u_thickness, waveFront, dist)
             * (1.0 - smoothstep(waveFront, waveFront + u_thickness * 0.5, dist));

  float opacity = wave * u_intensity * (1.0 - u_time);

  gl_FragColor = vec4(u_color, opacity);
}
