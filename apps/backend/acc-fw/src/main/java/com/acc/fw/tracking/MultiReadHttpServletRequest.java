package com.acc.fw.tracking;

import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.io.*;

public class MultiReadHttpServletRequest extends HttpServletRequestWrapper {
  private static final Logger logger = LoggerFactory.getLogger(MultiReadHttpServletRequest.class);
  private byte[] body;

  public MultiReadHttpServletRequest(HttpServletRequest httpServletRequest) {
    super(httpServletRequest);
    try {
      body = IOUtils.toByteArray(super.getInputStream());
    } catch (IOException e) {
      logger.error("Cannot read from HttpServletRequest input stream.", e);
    }
  }

  @Override
  public ServletInputStream getInputStream() throws IOException {
    return new ServletInputStreamImpl(new ByteArrayInputStream(body));
  }

  @Override
  public BufferedReader getReader() throws IOException {
    String enc = getCharacterEncoding();
    if (enc == null)
      enc = "UTF-8";
    return new BufferedReader(new InputStreamReader(getInputStream(), enc));
  }

  private class ServletInputStreamImpl extends ServletInputStream {

    private InputStream is;

    public ServletInputStreamImpl(InputStream is) {
      this.is = is;
    }

    public int read() throws IOException {
      return is.read();
    }

    public boolean markSupported() {
      return is.markSupported();
    }

    public synchronized void mark(int i) {
      is.mark(i);
    }

    public synchronized void reset() throws IOException {
      is.reset();
    }

    @Override
    public boolean isFinished() {
      return false;
    }

    @Override
    public boolean isReady() {
      return false;
    }

    @Override
    public void setReadListener(ReadListener readListener) {
    }
  }
}
