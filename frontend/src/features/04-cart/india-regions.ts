/**
 * The states and cities the address step offers.
 *
 * Two typed fields became two dropdowns for one reason: a mistyped city or a
 * state written four different ways ("Karnataka", "KA", "karnatka") is a parcel
 * a courier has to guess at, and the guess happens after the money has moved.
 * A list also makes the city field dependent on the state, which is the check a
 * free-text pair can never do — "Bengaluru, Maharashtra" passes every length
 * rule in `checkout-validation` and is still nowhere.
 *
 * The city lists are the served metros and district seats, not a gazetteer.
 * `withCurrent` is what keeps that from being a cage: an address already saved
 * in the book — or one from a build with a shorter list — keeps its own value
 * as a selectable option rather than being silently blanked on first render.
 */

export type Region = {
  state: string;
  cities: string[];
};

export const INDIA_REGIONS: Region[] = [
  {
    state: "Andaman and Nicobar Islands",
    cities: ["Port Blair", "Car Nicobar", "Diglipur", "Mayabunder", "Rangat"],
  },
  {
    state: "Andhra Pradesh",
    cities: [
      "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool",
      "Rajahmundry", "Tirupati", "Kakinada", "Anantapur", "Kadapa",
    ],
  },
  {
    state: "Arunachal Pradesh",
    cities: ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"],
  },
  {
    state: "Assam",
    cities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tezpur", "Tinsukia"],
  },
  {
    state: "Bihar",
    cities: [
      "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga",
      "Purnia", "Bihar Sharif", "Ara",
    ],
  },
  {
    state: "Chandigarh",
    cities: ["Chandigarh"],
  },
  {
    state: "Chhattisgarh",
    cities: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon"],
  },
  {
    state: "Dadra and Nagar Haveli and Daman and Diu",
    cities: ["Silvassa", "Daman", "Diu"],
  },
  {
    state: "Delhi",
    cities: [
      "New Delhi", "Dwarka", "Rohini", "Saket", "Karol Bagh",
      "Pitampura", "Janakpuri", "Vasant Kunj", "Shahdara", "Narela",
    ],
  },
  {
    state: "Goa",
    cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  },
  {
    state: "Gujarat",
    cities: [
      "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar",
      "Jamnagar", "Gandhinagar", "Junagadh", "Anand", "Bharuch",
    ],
  },
  {
    state: "Haryana",
    cities: [
      "Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal",
      "Hisar", "Rohtak", "Sonipat", "Panchkula", "Yamunanagar",
    ],
  },
  {
    state: "Himachal Pradesh",
    cities: ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu", "Manali", "Baddi"],
  },
  {
    state: "Jammu and Kashmir",
    cities: ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Katra"],
  },
  {
    state: "Jharkhand",
    cities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Hazaribagh", "Deoghar"],
  },
  {
    state: "Karnataka",
    cities: [
      "Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi",
      "Davangere", "Ballari", "Shivamogga", "Tumakuru", "Udupi",
    ],
  },
  {
    state: "Kerala",
    cities: [
      "Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam",
      "Alappuzha", "Palakkad", "Kannur", "Kottayam",
    ],
  },
  {
    state: "Ladakh",
    cities: ["Leh", "Kargil"],
  },
  {
    state: "Lakshadweep",
    cities: ["Kavaratti", "Agatti", "Minicoy"],
  },
  {
    state: "Madhya Pradesh",
    cities: [
      "Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain",
      "Sagar", "Satna", "Rewa", "Ratlam",
    ],
  },
  {
    state: "Maharashtra",
    cities: [
      "Mumbai", "Pune", "Nagpur", "Thane", "Nashik",
      "Navi Mumbai", "Aurangabad", "Solapur", "Kolhapur", "Amravati",
    ],
  },
  {
    state: "Manipur",
    cities: ["Imphal", "Thoubal", "Bishnupur", "Churachandpur"],
  },
  {
    state: "Meghalaya",
    cities: ["Shillong", "Tura", "Jowai", "Nongstoin"],
  },
  {
    state: "Mizoram",
    cities: ["Aizawl", "Lunglei", "Champhai", "Serchhip"],
  },
  {
    state: "Nagaland",
    cities: ["Kohima", "Dimapur", "Mokokchung", "Wokha"],
  },
  {
    state: "Odisha",
    cities: [
      "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur",
      "Sambalpur", "Puri", "Balasore",
    ],
  },
  {
    state: "Puducherry",
    cities: ["Puducherry", "Karaikal", "Yanam", "Mahe"],
  },
  {
    state: "Punjab",
    cities: [
      "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
      "Mohali", "Pathankot", "Hoshiarpur",
    ],
  },
  {
    state: "Rajasthan",
    cities: [
      "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer",
      "Bikaner", "Alwar", "Bhilwara", "Sikar",
    ],
  },
  {
    state: "Sikkim",
    cities: ["Gangtok", "Namchi", "Gyalshing", "Mangan"],
  },
  {
    state: "Tamil Nadu",
    cities: [
      "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
      "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Tiruppur",
    ],
  },
  {
    state: "Telangana",
    cities: [
      "Hyderabad", "Secunderabad", "Warangal", "Nizamabad",
      "Karimnagar", "Khammam", "Ramagundam",
    ],
  },
  {
    state: "Tripura",
    cities: ["Agartala", "Udaipur", "Dharmanagar", "Kailashahar"],
  },
  {
    state: "Uttar Pradesh",
    cities: [
      "Lucknow", "Noida", "Ghaziabad", "Kanpur", "Agra",
      "Varanasi", "Prayagraj", "Meerut", "Bareilly", "Gorakhpur",
    ],
  },
  {
    state: "Uttarakhand",
    cities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rishikesh", "Nainital"],
  },
  {
    state: "West Bengal",
    cities: [
      "Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri",
      "Darjeeling", "Kharagpur", "Malda",
    ],
  },
];

/** Every state and union territory, in the order the dropdown shows them. */
export const INDIAN_STATES: string[] = INDIA_REGIONS.map((region) => region.state);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The cities offered for a state, or nothing at all until one is picked. */
export function citiesOf(state: string): string[] {
  return INDIA_REGIONS.find((region) => sameName(region.state, state))?.cities ?? [];
}

/** True while the city belongs to the state — what a free-text pair cannot check. */
export function cityBelongsTo(state: string, city: string) {
  return citiesOf(state).some((entry) => sameName(entry, city));
}

/**
 * The options a `<select>` should render, with a value it does not know kept.
 *
 * A dropdown whose `value` matches no option renders empty, so a saved address
 * carrying a town this list has never heard of would appear to have lost its
 * city the moment the step opened. It is prepended instead — shown, selected,
 * and replaceable.
 */
export function withCurrent(options: string[], current: string) {
  const value = current.trim();
  if (!value) return options;
  return options.some((option) => sameName(option, value)) ? options : [value, ...options];
}
