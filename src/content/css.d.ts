/** esbuild loads .css imports as plain text (see build.mjs); it is injected
 *  into the panel's shadow root rather than the page stylesheet. */
declare module "*.css" {
  const contents: string;
  export default contents;
}
