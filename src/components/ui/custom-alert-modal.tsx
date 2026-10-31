import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type AlertType = "success" | "warning" | "error" | "info";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onClose?: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  type = "info",
  buttons = [{ text: "OK" }],
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
      iconScaleAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible, scaleAnim, fadeAnim, iconScaleAnim]);

  if (!visible) return null;

  const getTypeMeta = () => {
    switch (type) {
      case "success":
        return {
          icon: "checkmark-circle" as const,
          iconColor: "#059669",
          iconBg: "#ECFDF5",
          iconBorder: "#A7F3D0",
          btnBg: "#059669",
        };
      case "warning":
        return {
          icon: "warning" as const,
          iconColor: "#D97706",
          iconBg: "#FEF3C7",
          iconBorder: "#FDE68A",
          btnBg: "#D97706",
        };
      case "error":
        return {
          icon: "close-circle" as const,
          iconColor: "#DC2626",
          iconBg: "#FEF2F2",
          iconBorder: "#FECACA",
          btnBg: "#DC2626",
        };
      case "info":
      default:
        return {
          icon: "information-circle" as const,
          iconColor: "#2563EB",
          iconBg: "#EFF6FF",
          iconBorder: "#BFDBFE",
          btnBg: "#2563EB",
        };
    }
  };

  const meta = getTypeMeta();

  const handleButtonPress = (btn: AlertButton) => {
    if (onClose) onClose();
    if (btn.onPress) btn.onPress();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Animated Header Icon with Glow Circle */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: meta.iconBg,
                borderColor: meta.iconBorder,
                transform: [{ scale: iconScaleAnim }],
              },
            ]}
          >
            <Ionicons name={meta.icon} size={36} color={meta.iconColor} />
          </Animated.View>

          {/* Dialog Title */}
          <Text style={styles.titleText}>{title}</Text>

          {/* Dialog Message */}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonsRow,
              buttons.length > 1 && styles.buttonsRowMulti,
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn.style === "cancel";
              const isDestructive = btn.style === "destructive";

              return (
                <TouchableOpacity
                  key={`btn-${btn.text}-${index}`}
                  style={[
                    styles.button,
                    buttons.length > 1 && { flex: 1 },
                    isCancel
                      ? styles.buttonCancel
                      : isDestructive
                        ? styles.buttonDestructive
                        : { backgroundColor: meta.btnBg },
                  ]}
                  onPress={() => handleButtonPress(btn)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialogContainer: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonsRow: {
    width: "100%",
    gap: 10,
  },
  buttonsRowMulti: {
    flexDirection: "row",
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCancel: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  buttonDestructive: {
    backgroundColor: "#DC2626",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  buttonTextCancel: {
    color: "#475569",
  },
});

/**
 * Clean up verbose backend messages and format them for clarity
 */
export function cleanRawErrorMessage(msg: string): string {
  if (!msg || typeof msg !== "string") return "";
  let clean = msg.trim();

  // Pattern 1: Requested volume (X) exceeds (remaining) available capacity (Y)
  // e.g.: "Requested volume (70 m³) exceeds the remaining available capacity (65 m³) for Sales Order #SO/2627/0042. Total Ordered: 65 m³, Dispatched: 0 m³, Already Scheduled: 0 m³."
  const volMatch = clean.match(
    /Requested volume \(([^)]+)\) exceeds (?:the )?(?:remaining )?available capacity \(([^)]+)\)/i
  );
  if (volMatch) {
    return `Requested volume (${volMatch[1]}) exceeds available capacity (${volMatch[2]}).`;
  }

  // Pattern 2: Volume/Quantity exceeds balance
  const balanceMatch = clean.match(
    /(?:Requested )?(?:volume|quantity|qty) \(([^)]+)\) exceeds (?:the )?(?:order )?(?:remaining )?balance \(([^)]+)\)/i
  );
  if (balanceMatch) {
    return `Requested volume (${balanceMatch[1]}) exceeds remaining balance (${balanceMatch[2]}).`;
  }

  // Pattern 3: Strip verbose Sales Order & Total Ordered dump if present
  const splitIndex = clean.search(/\.\s*Total Ordered:|\s*for Sales Order #[^\.]*/i);
  if (splitIndex !== -1) {
    clean = clean.substring(0, splitIndex).trim();
  }

  // Cut off any remaining ". Total Ordered: ..." or ". Total: ..."
  const totalBreakdown = clean.search(/\.\s*(Total Ordered|Dispatched|Total|Breakdown):/i);
  if (totalBreakdown !== -1) {
    clean = clean.substring(0, totalBreakdown).trim();
  }

  // Remove trailing period or spaces
  clean = clean.replace(/[\.\s]+$/, "");

  if (clean.length > 0 && !clean.endsWith(".")) {
    clean += ".";
  }

  return clean;
}

/**
 * Extracts and formats errors from API responses into short, user-friendly messages.
 */
export function formatSubmissionError(
  err: any,
  fallback = "Submission failed. Please try again."
): string {
  if (!err) return fallback;

  if (err?.code === "ECONNABORTED" || err?.message?.toLowerCase().includes("timeout")) {
    return "Request timed out. Please check your network connection.";
  }
  if (err?.message?.toLowerCase().includes("network error")) {
    return "Network error. Please check your internet connection.";
  }
  if (err?.response?.status === 401) {
    return "Session expired. Please log in again.";
  }

  const data = err?.response?.data;

  // If backend returned HTML (500 or 404 error page)
  if (typeof data === "string") {
    if (data.includes("<html") || data.includes("<!DOCTYPE")) {
      return fallback;
    }
    return cleanRawErrorMessage(data) || fallback;
  }

  // 1. Check if there are field-specific errors in `errors`
  if (data?.errors && typeof data.errors === "object") {
    const list: string[] = [];
    for (const key of Object.keys(data.errors)) {
      const val = data.errors[key];
      if (Array.isArray(val)) {
        val.forEach((m) => {
          if (typeof m === "string" && m.trim()) {
            list.push(cleanRawErrorMessage(m));
          }
        });
      } else if (typeof val === "string" && val.trim()) {
        list.push(cleanRawErrorMessage(val));
      }
    }
    if (list.length > 0) {
      if (list.length === 1) {
        return list[0];
      }
      return list.slice(0, 2).map((s) => `• ${s}`).join("\n");
    }
  }

  // 2. If no errors list, check data.message
  if (data?.message && typeof data.message === "string") {
    const rawMsg = data.message.trim();
    if (rawMsg.toLowerCase().includes("the given data was invalid")) {
      return "Please review the form for missing or invalid details.";
    }
    const cleaned = cleanRawErrorMessage(rawMsg);
    if (cleaned) return cleaned;
  }

  // 3. Fallback to top-level err.message
  if (err?.message && typeof err.message === "string") {
    const cleaned = cleanRawErrorMessage(err.message);
    if (cleaned) return cleaned;
  }

  return fallback;
}


