package com.acc.fw.helper;

import com.acc.domain.constant.SystemConstant;
import com.acc.fw.message.ResultMessages;

import org.springframework.ui.Model;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

public final class MessageHelper {

  public static void addSuccess(RedirectAttributes ra, String message, Object... args) {
    addAttribute(ra, ResultMessages.success().add(message, args));
  }

  public static void addError(RedirectAttributes ra, String message, Object... args) {
    addAttribute(ra, ResultMessages.danger().add(message, args));
  }

  public static void addInfo(RedirectAttributes ra, String message, Object... args) {
    addAttribute(ra, ResultMessages.info().add(message, args));
  }

  public static void addWarning(RedirectAttributes ra, String message, Object... args) {
    addAttribute(ra, ResultMessages.warning().add(message, args));
  }

  private static void addAttribute(RedirectAttributes ra, ResultMessages message) {
    ra.addFlashAttribute(SystemConstant.BEAN_NAME_MESSAGES, message);
  }

  public static void addSuccess(Model model, String message, Object... args) {
    addAttribute(model, ResultMessages.success().add(message, args));
  }

  public static void addError(Model model, String message, Object... args) {
    addAttribute(model, ResultMessages.danger().add(message, args));
  }

  public static void addInfo(Model model, String message, Object... args) {
    addAttribute(model, ResultMessages.info().add(message, args));
  }

  public static void addWarning(Model model, String message, Object... args) {
    addAttribute(model, ResultMessages.warning().add(message, args));
  }

  private static void addAttribute(Model model, ResultMessages messages) {
    model.addAttribute(SystemConstant.BEAN_NAME_MESSAGES, messages);
  }
}
