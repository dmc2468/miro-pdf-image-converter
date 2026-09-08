import { describe, expect, it } from "vitest";
import { referralTotals, saveReferralOrder, type ReferralOrder } from "./referral-rewards";
import { searchOrders } from "./order-search";

const referrer = { id: "cam", name: "Cameron", referralsPerReward: 1 };
const client = (id: string, fields: Partial<ReferralOrder> = {}): ReferralOrder => ({id, name: id, source: "private", referrerId: "cam", ...fields});

describe("referral rewards", () => {
  it("counts eight clients and four redemptions without double-counting a linked free job", () => {
    const rows = [client("Atul", {referralRedeemed:true}), client("Darek", {referralRedeemed:true}), client("James", {referralRedeemed:true}), client("Gabrielle", {referralRedeemed:true, referralRewardOrderId:"free"}), ...["Dimitris", "Evgeni", "Sarah Wilson", "Shastri"].map(name => client(name)), client("free", {name:"Cameron", referrerId:undefined, rewardForId:"cam"})];
    expect(referralTotals(rows, referrer)).toMatchObject({referred:8, earned:8, used:4, owed:4});
  });
  it("counts repeat orders once and supports three referrals per reward", () => {
    const rows=[client("a"), client("b"), client("c"), client("repeat", {name:"a"})];
    expect(referralTotals(rows, {...referrer, referralsPerReward:3})).toMatchObject({referred:3,earned:1,owed:1});
  });
  it("propagates redemption records without changing referred client payments", () => {
    const rows=[client("a", {customerPrice:25,received:20}),client("repeat",{name:"a", customerPrice:30})];
    const saved=saveReferralOrder(rows,{...rows[0],referralRedeemed:true});
    expect(saved.every(row=>row.referralRedeemed)).toBe(true);
    expect(saved.map(row=>row.customerPrice)).toEqual([25,30]);
    expect(saved[0].received).toBe(20);
  });
  it("sets a reward job to free and inherits the existing client referral", () => {
    const rows=[client("a")];
    expect(saveReferralOrder(rows,client("new",{name:"a",referrerId:undefined}))[1].referrerId).toBe("cam");
    expect(saveReferralOrder(rows,client("free",{name:"Cameron",rewardForId:"cam",customerPrice:25}))[1]).toMatchObject({customerPrice:0,received:0,payment:"Paid"});
  });
});

describe("client search", () => {
  const rows=[{name:"Cameron",racquet:"Percept"},{name:"James (from Cameron)",racquet:"Drive"},{name:"Cameron Smith",racquet:"Blade"}];
  it("shows only the exact client when their name matches",()=>expect(searchOrders(rows,"Cameron")).toEqual([rows[0]]));
  it("does not search referrer annotations",()=>expect(searchOrders(rows.slice(1),"Cameron")).toEqual([rows[2]]));
  it("still supports racket searches",()=>expect(searchOrders(rows,"Drive")).toEqual([rows[1]]));
});
