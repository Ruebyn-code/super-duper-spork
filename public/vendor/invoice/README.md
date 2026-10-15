# Bundled invoice recognition libraries

These files are loaded only when the Home invoice scanner is used. They run locally in the browser; no invoice or image is sent to an OCR provider. All recognition assets are served by this app, including the English language model and PDF standard fonts.

Sources (unmodified npm distributions):
- tesseract.js 6.0.1 — https://registry.npmjs.org/tesseract.js/-/tesseract.js-6.0.1.tgz — Apache-2.0; see TESSERACT-LICENSE.txt.
- tesseract.js-core 6.0.0 — https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-6.0.0.tgz — Apache-2.0; see CORE-LICENSE.txt. The LSTM builds include their WebAssembly binaries.
- @tesseract.js-data/eng 1.0.0, 4.0.0_best_int model — https://registry.npmjs.org/@tesseract.js-data/eng/-/eng-1.0.0.tgz — Apache-2.0 (Tesseract tessdata); see CORE-LICENSE.txt.
- pdfjs-dist 4.10.38 — https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-4.10.38.tgz — Apache-2.0; see PDFJS-LICENSE.txt. Standard fonts retain their Foxit and Liberation licenses in standard_fonts/.

SHA-256:
c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08  CORE-LICENSE.txt
0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594  PDFJS-LICENSE.txt
b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1  TESSERACT-LICENSE.txt
45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91  eng.traineddata.gz
27fc2a057a00f92a4334ad06e17dbd7259912954e9fb7f76400bcca5fd190a9c  pdf.min.mjs
1baa1844c89c80a5b2797c916e75ab29254be46d8e9cb53cb6364d7aad84be36  pdf.worker.min.mjs
845c752392b6c914fb989c75a08b7792b88f542d2499042ef2889f8c814a16ed  standard_fonts/FoxitDingbats.pfb
b6c8fe53f134b8b6d4578cd2d544df4cee9624c4efa8d51a560fb40ea296101b  standard_fonts/FoxitFixed.pfb
f1b7159702973f54fc86254ea38bcf3712b2a736eb3a0995751e9f4bb45ad603  standard_fonts/FoxitFixedBold.pfb
8a000945843bd31add06aee63bf9fd41b7578b4f3242a4b7cd46349ad9d24d4d  standard_fonts/FoxitFixedBoldItalic.pfb
5007faf8320fa1fcc08b8894b356ad976f60b992ba29ee5272578bbdebaf3876  standard_fonts/FoxitFixedItalic.pfb
4f57d2b9d884af8f907bf22df6019b52d86cbf6214fdbd02b1ae05472a543f35  standard_fonts/FoxitSerif.pfb
0bdf4b04e964139818d51eda03d566ba999fc3ba2421b1c6c51f9dc969022e80  standard_fonts/FoxitSerifBold.pfb
a406cac82583bf98175cb62c87ed5e95c45fbb34eece63a10b0a13e793cb2e10  standard_fonts/FoxitSerifBoldItalic.pfb
610ae0687198045c4db5d1a6650fd5e92536631706382eb8b72e38df578d0ae9  standard_fonts/FoxitSerifItalic.pfb
47967d055530e7357088a08403115425643ec2cdfd6201ba8af0fbd7116c1539  standard_fonts/FoxitSymbol.pfb
b578cdd2345840ada550bd12519533812320d5f1d21cf4c1c7e1b1b0a31c98b7  standard_fonts/LICENSE_FOXIT
93fed46019c38bbe566b479d22148e2e8a1e85ada614accb0211c37b2c61c19b  standard_fonts/LICENSE_LIBERATION
361c61b82d575c5c35fd9157fda8b0194bcfcd0d88ea8521a4fb5dd53d33dddc  standard_fonts/LiberationSans-Bold.ttf
a224075ac17495ad0a3af3bc0a419ac0704a8b3fd1095456201fb9b095fc281d  standard_fonts/LiberationSans-BoldItalic.ttf
832b4406dbef23628800d3aaad21048534ac84d7e3ad955be83b8172ed8ef512  standard_fonts/LiberationSans-Italic.ttf
f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f  standard_fonts/LiberationSans-Regular.ttf
775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687  tesseract-core-lstm.wasm.js
9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7  tesseract-core-simd-lstm.wasm.js
10fff78484067759c43028a02a72d76d0b90eb17302bb23b58a9ec5410bc928b  tesseract.min.js
38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842  worker.min.js
