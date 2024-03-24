uniform sampler2D tDiffuse;
uniform vec2 uStartPos;
uniform vec2 uEndPos;

varying vec2 vUv;

void main()
{
	vec4 texel = texture2D( tDiffuse, vUv );

   vec4 bounds = vec4(min(uStartPos.x, uEndPos.x),
                      max(uStartPos.x, uEndPos.x),
                      min(uStartPos.y, uEndPos.y),
                      max(uStartPos.y, uEndPos.y)); 

   float inBox = float(vUv.x >= bounds.x &&
         vUv.x <= bounds.y &&
         vUv.y >= bounds.z &&
         vUv.y <= bounds.w);

   gl_FragColor = texel * (0.7 + 0.3 *(1. - inBox)) + 0.3 * inBox * vec4(0.,1.,0.,1.);
}