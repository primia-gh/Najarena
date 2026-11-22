import { describe, expect, it } from "vitest";
import { estAdressePushValide } from "./push";

describe("adresses de notification push", () => {
  it("accepte les services de push des navigateurs, en https", () => {
    expect(estAdressePushValide("https://fcm.googleapis.com/fcm/send/abc:def")).toBe(true);
    expect(estAdressePushValide("https://updates.push.services.mozilla.com/wpush/v2/gAAA")).toBe(true);
    expect(estAdressePushValide("https://web.push.apple.com/QGx1")).toBe(true);
    expect(estAdressePushValide("https://api.push.apple.com/QGx1")).toBe(true);
    expect(estAdressePushValide("https://jmt17.google.com/fcm/send/abc:def")).toBe(true);
    expect(estAdressePushValide("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
  });

  it("refuse toute autre adresse", () => {
    expect(estAdressePushValide("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(estAdressePushValide("https://exemple.com/push")).toBe(false);
    expect(estAdressePushValide("https://fcm.googleapis.com.exemple.com/x")).toBe(false);
    expect(estAdressePushValide("https://push.apple.com.exemple.com/x")).toBe(false);
    expect(estAdressePushValide("https://faux-push.apple.com.exemple.com/x")).toBe(false);
    expect(estAdressePushValide("https://jmt17.google.com.exemple.com/x")).toBe(false);
    expect(estAdressePushValide("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(estAdressePushValide(`https://fcm.googleapis.com/${"a".repeat(1000)}`)).toBe(false);
  });
});
