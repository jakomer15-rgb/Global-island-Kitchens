import { describe, expect, it } from "vitest";
import { AUTOPILOT_NOTE, bahrainDayStarted, heldReasons, holdText, isAutopilotDecision } from "./autopilot";

describe("heldReasons", () => {
  it("lets a plain, factual reply through", () => {
    expect(
      heldReasons(
        "Thank you for your enquiry about a handleless kitchen. Could you send us the room measurements and the area of your home? You are welcome to visit our showroom, or we can arrange a call at a time that suits you.",
      ),
    ).toEqual([]);
    expect(
      heldReasons(
        "شكرًا لتواصلكم بخصوص المطبخ. هل يمكنكم إرسال مقاسات الغرفة ومنطقة المنزل؟ يسعدنا استقبالكم في صالة العرض أو ترتيب مكالمة في الوقت المناسب لكم.",
      ),
    ).toEqual([]);
  });

  it("holds prices, discounts and money", () => {
    expect(heldReasons("Kitchens start from 1,500 BHD for a standard layout.")).toContain("money");
    expect(heldReasons("Enjoy a 10% discount this month on wardrobes.")).toContain("money");
    expect(heldReasons("We can offer a free consultation at your home anytime.")).toContain("money");
    expect(heldReasons("تبدأ الأسعار من ١٥٠٠ دينار للمطبخ القياسي")).toContain("money");
    expect(heldReasons("Our prices are the best in Bahrain, contact us now.")).toContain("money");
  });

  it("holds promises of time, delivery or warranty", () => {
    expect(heldReasons("Your kitchen will be installed within 3 weeks of approval.")).toContain("promise");
    expect(heldReasons("All cabinets come with a 5 years warranty and full support.")).toContain("promise");
    expect(heldReasons("نسلم المطبخ خلال ٢١ يوم من الموافقة على التصميم")).toContain("promise");
    expect(heldReasons("جميع المطابخ عليها ضمان شامل من الشركة")).toContain("promise");
  });

  it("holds links elsewhere, email addresses and placeholders", () => {
    expect(heldReasons("See our designs at https://example.com/kitchens today.")).toContain("link");
    expect(heldReasons("Send your drawings on www.globalislandkitchens.com/contact please.")).not.toContain(
      "link",
    );
    expect(heldReasons("Write to us at someone@example.com with the plans.")).toContain("email");
    expect(heldReasons("Dear [Customer Name], thank you for your message today.")).toContain("placeholder");
    expect(heldReasons("We would love to work with {company} on this project.")).toContain("placeholder");
  });

  it("holds materials and claims we can't make", () => {
    expect(heldReasons("Our kitchens use solid oak doors with granite worktops.")).toContain("material");
    expect(heldReasons("مطابخنا مصنوعة من الخشب الطبيعي والرخام الفاخر")).toContain("material");
    expect(heldReasons("We have completed 500+ projects for happy clients in Bahrain.")).toContain("claim");
    expect(heldReasons("Made with EGGER laminate boards and painted MDF in our Bahrain factory.")).toEqual(
      [],
    );
  });

  it("holds empty text", () => {
    expect(heldReasons("   ")).toEqual(["empty"]);
  });

  it("describes reasons in both languages", () => {
    expect(holdText(["money", "link"])).toBe("mentions a price, cost or discount, links to another website");
    expect(holdText(["money"], "ar")).toContain("سعر");
  });
});

describe("autopilot helpers", () => {
  it("recognises its own approvals", () => {
    expect(isAutopilotDecision(AUTOPILOT_NOTE)).toBe(true);
    expect(isAutopilotDecision("Looks good")).toBe(false);
    expect(isAutopilotDecision(null)).toBe(false);
  });

  it("starts the day at midnight in Bahrain", () => {
    // 2026-11-19 22:30 UTC is 01:30 on the 20th in Bahrain.
    expect(bahrainDayStarted(new Date("2026-11-19T22:30:00Z")).toISOString()).toBe(
      "2026-11-19T21:00:00.000Z",
    );
    expect(bahrainDayStarted(new Date("2026-11-19T20:00:00Z")).toISOString()).toBe(
      "2026-11-18T21:00:00.000Z",
    );
  });
});
