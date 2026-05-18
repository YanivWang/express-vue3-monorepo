declare module "spark-md5" {
  interface SparkMD5ArrayBuffer {
    append(chunk: ArrayBuffer): void;
    end(raw?: boolean): string;
  }

  interface SparkMD5Constructor {
    ArrayBuffer: new () => SparkMD5ArrayBuffer;
  }

  const SparkMD5: SparkMD5Constructor;
  export default SparkMD5;
}
