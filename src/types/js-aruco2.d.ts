// js-aruco2 ships without type definitions. This covers the dictionary and detector the templates use.
declare module 'js-aruco2' {
  type Corner = { x: number; y: number };
  const aruco: {
    AR: {
      Dictionary: new (name: string) => { codeList: string[] };
      Detector: new (config: { dictionaryName: string; maxHammingDistance?: number }) => {
        detect(image: { width: number; height: number; data: Uint8ClampedArray }): { id: number; corners: Corner[] }[];
      };
    };
  };
  export default aruco;
}
