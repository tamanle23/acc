package com.acc.core.helper;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

public class QrGenerationHelper {
  public static final String BASE64_PREFIX = "data:image/png;base64,";
  public static final String FILETYPE_JPG = "jpg";
  public static final String FILETYPE_PNG = "png";
  public static QrGenerationHelper INSTANCE = new QrGenerationHelper();
  private static Logger logger = LoggerFactory.getLogger(QrGenerationHelper.class);

  public void writeQrCodeFile(String codeContent,String fileType, Path filePath) throws IOException{
    ByteArrayOutputStream outputStream = this.generate(codeContent, fileType);
    Files.write(filePath, outputStream.toByteArray(),StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING);
  }

  public String getBase64QrCode(String codeContent,String fileType){
    ByteArrayOutputStream outputStream = this.generate(codeContent, fileType);
    return BASE64_PREFIX+Base64.getEncoder().encodeToString(outputStream.toByteArray());
  }

  private ByteArrayOutputStream generate(String codeContent, String fileType) {
    int size = 250;
    BufferedImage image=null;
    ByteArrayOutputStream outputStream = null;
    try {

      Map<EncodeHintType, Object> hintMap = new EnumMap<EncodeHintType, Object>(EncodeHintType.class);
      hintMap.put(EncodeHintType.CHARACTER_SET, "UTF-8");

      // Now with zxing version 3.2.1 you could change border size (white border size to just 1)
      hintMap.put(EncodeHintType.MARGIN, 1); /* default = 4 */
      hintMap.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.L);

      QRCodeWriter qrCodeWriter = new QRCodeWriter();
      BitMatrix byteMatrix = qrCodeWriter.encode(codeContent, BarcodeFormat.QR_CODE, size, size, hintMap);
      int crunchifyWidth = byteMatrix.getWidth();
      image = new BufferedImage(crunchifyWidth, crunchifyWidth,BufferedImage.TYPE_INT_RGB);
      image.createGraphics();

      Graphics2D graphics = (Graphics2D) image.getGraphics();
      graphics.setColor(Color.WHITE);
      graphics.fillRect(0, 0, crunchifyWidth, crunchifyWidth);
      graphics.setColor(Color.BLACK);

      for (int i = 0; i < crunchifyWidth; i++) {
        for (int j = 0; j < crunchifyWidth; j++) {
          if (byteMatrix.get(i, j)) {
            graphics.fillRect(i, j, 1, 1);
          }
        }
      }
      outputStream = new ByteArrayOutputStream();
      ImageIO.write(image, fileType, outputStream);
    } catch (WriterException e) {
      logger.error("Written error.",e);
    } catch (IOException e) {
      logger.error("IO error.",e);
    }
    return outputStream;
  }
}
