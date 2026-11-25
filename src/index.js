/**
 * Mi Granja staff portal and booking API.
 * Data lives in a private D1 database. Secrets are Worker bindings, never in source.
 */
import { handleOps } from "./ops.js";

const ALLOWED_ORIGINS = [
  "https://www.migranjaevents.com",
  "https://migranjaevents.com"
];

const TZ = "Asia/Manila";
const PBKDF2_ITERATIONS = 100000;
const PASSWORD_ALGO = "pbkdf2-sha256-100000";
const SESSION_DAYS = 30;
const SESSION_IDLE_DAYS = 7;
const TEMP_PASSWORD_HOURS = 72;
const MAX_PUBLIC_POSTS_PER_HOUR = 8;
const PENDING_PER_DATE = 8;
const PENDING_DAYS = 7;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_PER_IP = 10;
const LOGIN_MAX_PER_ACCOUNT = 5;
const LOGIN_TURNSTILE_AFTER = 3;
const TURNSTILE_SITE_KEY = "0x4AAAAAAGSrpXsnJmbKqvfS";
const HELD_STATUSES = new Set(["Confirmed", "Tentative", "Setup", "Booked"]);
const EVENT_STATUSES = ["Confirmed", "Tentative", "Setup", "Booked", "Completed", "Cancelled"];
const REQUEST_STATUSES = ["pending", "approved", "declined", "expired"];
const EVENT_TYPES = ["Wedding", "Debut", "Birthday", "Christening", "Corporate", "Other"];
const VENUES = ["Any", "Ballroom", "The Nook", "Amore Garden"];
const SHIFT_ROLES = ["Venue manager", "Event coordinator", "Floor supervisor", "Staff", "Kitchen", "Other"];
const COMMON_PASSWORDS = new Set([
  "!qaz2wsx", "000000", "00000000", "0987654321", "1020304050", "111111",
  "11111111", "1111111111", "112233", "11223344", "1122334455", "121212",
  "12121212", "1212121212", "123123123", "12341234", "123412345", "123456",
  "1234567", "12345678", "123456789", "1234567890", "12345678910", "123456789a",
  "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "1qaz2wsx3edc", "1qazxsw2", "654321",
  "987654321", "9876543210", "aa123456", "aa12345678", "aa123456789", "abc",
  "abc!", "abc1", "abc1!", "abc12", "abc12!", "abc123",
  "abc123!", "abc1234", "abc12345", "abc123456", "abc1234567", "abc2020",
  "abc2021", "abc2022", "abc2023", "abc2024", "abc2025", "abc2026",
  "abcabcabc", "abcd1234", "abcd12345", "abcdabcd", "access", "access123",
  "admin", "admin!", "admin1", "admin1!", "admin12", "admin12!",
  "admin123", "admin123!", "admin1234", "admin12345", "admin123456", "admin2020",
  "admin2021", "admin2022", "admin2023", "admin2024", "admin2025", "admin2026",
  "adminadmin", "adminadmin1", "administrator", "always", "always123", "amanda",
  "amanda123", "amen", "amen12345", "andrea", "andrea123", "andrew",
  "andrew123", "android123", "apple", "apple1234", "arsenal", "arsenal123",
  "asdf1234", "asdf12345", "asdfghjkl", "asdfghjkl;", "ashley", "ashley123",
  "autumn", "autumn123", "azerty", "azerty123", "baby", "baby12345",
  "backup", "backup!", "backup1", "backup1!", "backup12", "backup12!",
  "backup123", "backup123!", "backup1234", "backup12345", "backup123456", "backup2020",
  "backup2021", "backup2022", "backup2023", "backup2024", "backup2025", "backup2026",
  "banana", "banana123", "barcelona", "barcelona1", "baseball", "baseball!",
  "baseball1", "baseball1!", "baseball12", "baseball12!", "baseball123", "baseball123!",
  "baseball1234", "baseball12345", "baseball123456", "baseball2020", "baseball2021", "baseball2022",
  "baseball2023", "baseball2024", "baseball2025", "baseball2026", "batangas1", "batman",
  "batman!", "batman1", "batman1!", "batman12", "batman12!", "batman123",
  "batman123!", "batman1234", "batman12345", "batman123456", "batman2020", "batman2021",
  "batman2022", "batman2023", "batman2024", "batman2025", "batman2026", "beauty",
  "beauty123", "bitcoin", "bitcoin123", "blessed", "blessed123", "booking",
  "booking!", "booking1", "booking1!", "booking12", "booking12!", "booking123",
  "booking123!", "booking1234", "booking12345", "booking123456", "booking2020", "booking2021",
  "booking2022", "booking2023", "booking2024", "booking2025", "booking2026", "burger",
  "burger123", "buster", "buster123", "cavite", "cavite!", "cavite1",
  "cavite1!", "cavite12", "cavite12!", "cavite123", "cavite123!", "cavite1234",
  "cavite12345", "cavite123456", "cavite2020", "cavite2021", "cavite2022", "cavite2023",
  "cavite2024", "cavite2025", "cavite2026", "cebu", "cebu12345", "champion",
  "champion1", "changeme", "changeme!", "changeme1", "changeme1!", "changeme12",
  "changeme12!", "changeme123", "changeme123!", "changeme1234", "changeme12345", "changeme123456",
  "changeme2020", "changeme2021", "changeme2022", "changeme2023", "changeme2024", "changeme2025",
  "changeme2026", "charles", "charles123", "charlie", "charlie!", "charlie1",
  "charlie1!", "charlie12", "charlie12!", "charlie123", "charlie123!", "charlie1234",
  "charlie12345", "charlie123456", "charlie2020", "charlie2021", "charlie2022", "charlie2023",
  "charlie2024", "charlie2025", "charlie2026", "chelsea", "chelsea123", "chicken",
  "chicken123", "coffee", "coffee123", "college", "college123", "company",
  "company!", "company1", "company1!", "company12", "company12!", "company123",
  "company123!", "company1234", "company12345", "company123456", "company2020", "company2021",
  "company2022", "company2023", "company2024", "company2025", "company2026", "computer",
  "computer!", "computer1", "computer1!", "computer12", "computer12!", "computer123",
  "computer123!", "computer1234", "computer12345", "computer123456", "computer2020", "computer2021",
  "computer2022", "computer2023", "computer2024", "computer2025", "computer2026", "cookie",
  "cookie123", "cowboys", "cowboys123", "daddy", "daddy1234", "daniel",
  "daniel123", "database", "database1", "davao", "davao1234", "david",
  "david1234", "december", "december1", "default", "default!", "default1",
  "default1!", "default12", "default12!", "default123", "default123!", "default1234",
  "default12345", "default123456", "default2020", "default2021", "default2022", "default2023",
  "default2024", "default2025", "default2026", "demo", "demo12345", "demoaccount",
  "dragon", "dragon!", "dragon1", "dragon1!", "dragon12", "dragon12!",
  "dragon123", "dragon123!", "dragon1234", "dragon12345", "dragon123456", "dragon2020",
  "dragon2021", "dragon2022", "dragon2023", "dragon2024", "dragon2025", "dragon2026",
  "elizabeth", "elizabeth1", "events", "events!", "events1", "events1!",
  "events12", "events12!", "events123", "events123!", "events1234", "events12345",
  "events123456", "events2020", "events2021", "events2022", "events2023", "events2024",
  "events2025", "events2026", "facebook", "facebook!", "facebook1", "facebook1!",
  "facebook12", "facebook12!", "facebook123", "facebook123!", "facebook1234", "facebook12345",
  "facebook123456", "facebook2020", "facebook2021", "facebook2022", "facebook2023", "facebook2024",
  "facebook2025", "facebook2026", "family", "family!", "family1", "family1!",
  "family12", "family12!", "family123", "family123!", "family1234", "family12345",
  "family123456", "family2020", "family2021", "family2022", "family2023", "family2024",
  "family2025", "family2026", "february", "february1", "flower", "flower123",
  "football", "football!", "football1", "football1!", "football12", "football12!",
  "football123", "football123!", "football1234", "football12345", "football123456", "football2020",
  "football2021", "football2022", "football2023", "football2024", "football2025", "football2026",
  "forever", "forever123", "freedom", "freedom!", "freedom1", "freedom1!",
  "freedom12", "freedom12!", "freedom123", "freedom123!", "freedom1234", "freedom12345",
  "freedom123456", "freedom2020", "freedom2021", "freedom2022", "freedom2023", "freedom2024",
  "freedom2025", "freedom2026", "friday", "friday123", "friends", "friends!",
  "friends1", "friends1!", "friends12", "friends12!", "friends123", "friends123!",
  "friends1234", "friends12345", "friends123456", "friends2020", "friends2021", "friends2022",
  "friends2023", "friends2024", "friends2025", "friends2026", "ginger", "ginger123",
  "godisgood", "godisgood1", "golf", "golf12345", "google", "google!",
  "google1", "google1!", "google12", "google12!", "google123", "google123!",
  "google1234", "google12345", "google123456", "google2020", "google2021", "google2022",
  "google2023", "google2024", "google2025", "google2026", "granja", "granja123",
  "guest", "guest!", "guest1", "guest1!", "guest12", "guest12!",
  "guest123", "guest123!", "guest1234", "guest12345", "guest123456", "guest2020",
  "guest2021", "guest2022", "guest2023", "guest2024", "guest2025", "guest2026",
  "happy", "happy1234", "harley", "harley123", "hello", "hello!",
  "hello1", "hello1!", "hello12", "hello12!", "hello123", "hello123!",
  "hello1234", "hello12345", "hello123456", "hello2020", "hello2021", "hello2022",
  "hello2023", "hello2024", "hello2025", "hello2026", "hellohello", "hockey",
  "hockey!", "hockey1", "hockey1!", "hockey12", "hockey12!", "hockey123",
  "hockey123!", "hockey1234", "hockey12345", "hockey123456", "hockey2020", "hockey2021",
  "hockey2022", "hockey2023", "hockey2024", "hockey2025", "hockey2026", "hottie",
  "hottie123", "hunter", "hunter!", "hunter1", "hunter1!", "hunter12",
  "hunter12!", "hunter123", "hunter123!", "hunter1234", "hunter12345", "hunter123456",
  "hunter2020", "hunter2021", "hunter2022", "hunter2023", "hunter2024", "hunter2025",
  "hunter2026", "iloveu", "iloveu1234", "iloveyou", "iloveyou!", "iloveyou1",
  "iloveyou1!", "iloveyou12", "iloveyou12!", "iloveyou123", "iloveyou123!", "iloveyou1234",
  "iloveyou12345", "iloveyou123456", "iloveyou2020", "iloveyou2021", "iloveyou2022", "iloveyou2023",
  "iloveyou2024", "iloveyou2025", "iloveyou2026", "instagram", "instagram!", "instagram1",
  "instagram1!", "instagram12", "instagram12!", "instagram123", "instagram123!", "instagram1234",
  "instagram12345", "instagram123456", "instagram2020", "instagram2021", "instagram2022", "instagram2023",
  "instagram2024", "instagram2025", "instagram2026", "internet", "internet!", "internet1",
  "internet1!", "internet12", "internet12!", "internet123", "internet123!", "internet1234",
  "internet12345", "internet123456", "internet2020", "internet2021", "internet2022", "internet2023",
  "internet2024", "internet2025", "internet2026", "iphone", "iphone123", "james",
  "james1234", "january", "january123", "jennifer", "jennifer!", "jennifer1",
  "jennifer1!", "jennifer12", "jennifer12!", "jennifer123", "jennifer123!", "jennifer1234",
  "jennifer12345", "jennifer123456", "jennifer2020", "jennifer2021", "jennifer2022", "jennifer2023",
  "jennifer2024", "jennifer2025", "jennifer2026", "jessica", "jessica123", "jesus",
  "jesus1234", "john", "john12345", "jordan", "jordan123", "jordan1234",
  "jordan23", "joseph", "joseph123", "joshua", "joshua123", "laguna123",
  "lakers", "lakers123", "letmein", "letmein!", "letmein1", "letmein1!",
  "letmein12", "letmein12!", "letmein123", "letmein123!", "letmein1234", "letmein12345",
  "letmein123456", "letmein2020", "letmein2021", "letmein2022", "letmein2023", "letmein2024",
  "letmein2025", "letmein2026", "liverpool", "liverpool1", "login", "login!",
  "login1", "login1!", "login12", "login12!", "login123", "login123!",
  "login1234", "login12345", "login123456", "login2020", "login2021", "login2022",
  "login2023", "login2024", "login2025", "login2026", "love", "love12345",
  "lovely", "lovely123", "loveme", "loveme123", "loveyou", "loveyou123",
  "macintosh", "makati", "makati123", "manager", "manager!", "manager1",
  "manager1!", "manager12", "manager12!", "manager123", "manager123!", "manager1234",
  "manager12345", "manager123456", "manager2020", "manager2021", "manager2022", "manager2023",
  "manager2024", "manager2025", "manager2026", "mango", "mango1234", "manila",
  "manila!", "manila1", "manila1!", "manila12", "manila12!", "manila123",
  "manila123!", "manila1234", "manila12345", "manila123456", "manila2020", "manila2021",
  "manila2022", "manila2023", "manila2024", "manila2025", "manila2026", "master",
  "master!", "master1", "master1!", "master12", "master12!", "master123",
  "master123!", "master1234", "master12345", "master123456", "master2020", "master2021",
  "master2022", "master2023", "master2024", "master2025", "master2026", "matthew",
  "matthew123", "melissa", "melissa123", "michael", "michael!", "michael1",
  "michael1!", "michael12", "michael12!", "michael123", "michael123!", "michael1234",
  "michael12345", "michael123456", "michael2020", "michael2021", "michael2022", "michael2023",
  "michael2024", "michael2025", "michael2026", "michelle", "michelle1", "migranja",
  "migranja!", "migranja1", "migranja1!", "migranja12", "migranja12!", "migranja123",
  "migranja123!", "migranja1234", "migranja12345", "migranja123456", "migranja2020", "migranja2021",
  "migranja2022", "migranja2023", "migranja2024", "migranja2025", "migranja2026", "million",
  "million123", "minecraft", "minecraft!", "minecraft1", "minecraft1!", "minecraft12",
  "minecraft12!", "minecraft123", "minecraft123!", "minecraft1234", "minecraft12345", "minecraft123456",
  "minecraft2020", "minecraft2021", "minecraft2022", "minecraft2023", "minecraft2024", "minecraft2025",
  "minecraft2026", "mommy", "mommy1234", "monday", "monday123", "money",
  "money1234", "monitor", "monitor123", "monkey", "monkey!", "monkey1",
  "monkey1!", "monkey12", "monkey12!", "monkey123", "monkey123!", "monkey1234",
  "monkey12345", "monkey123456", "monkey2020", "monkey2021", "monkey2022", "monkey2023",
  "monkey2024", "monkey2025", "monkey2026", "mysql", "mysql1234", "naruto",
  "naruto!", "naruto1", "naruto1!", "naruto12", "naruto12!", "naruto123",
  "naruto123!", "naruto1234", "naruto12345", "naruto123456", "naruto2020", "naruto2021",
  "naruto2022", "naruto2023", "naruto2024", "naruto2025", "naruto2026", "netflix",
  "netflix123", "network", "network123", "nicole", "nicole123", "november1",
  "office", "office!", "office1", "office1!", "office12", "office12!",
  "office123", "office123!", "office1234", "office12345", "office123456", "office2020",
  "office2021", "office2022", "office2023", "office2024", "office2025", "office2026",
  "oracle", "oracle123", "orange", "orange123", "p@ssw0rd", "p@ssw0rd1",
  "p@ssword", "p@ssword1", "p@ssword123", "pass", "pass!", "pass1",
  "pass1!", "pass12", "pass12!", "pass123", "pass123!", "pass1234",
  "pass12345", "pass123456", "pass2020", "pass2021", "pass2022", "pass2023",
  "pass2024", "pass2025", "pass2026", "pass@word1", "pass@word123", "passpass",
  "passpass1", "passw0rd", "passw0rd1", "password", "password!", "password1",
  "password1!", "password12", "password12!", "password123", "password123!", "password1234",
  "password12345", "password123456", "password2020", "password2021", "password2022", "password2023",
  "password2024", "password2025", "password2026", "peace", "peace1234", "pepper",
  "pepper123", "philippines", "philippines!", "philippines1", "philippines1!", "philippines12",
  "philippines12!", "philippines123", "philippines123!", "philippines1234", "philippines12345", "philippines123456",
  "philippines2020", "philippines2021", "philippines2022", "philippines2023", "philippines2024", "philippines2025",
  "philippines2026", "pilipinas1", "pilipinas123", "pizza", "pizza1234", "pokemon",
  "pokemon!", "pokemon1", "pokemon1!", "pokemon12", "pokemon12!", "pokemon123",
  "pokemon123!", "pokemon1234", "pokemon12345", "pokemon123456", "pokemon2020", "pokemon2021",
  "pokemon2022", "pokemon2023", "pokemon2024", "pokemon2025", "pokemon2026", "postgres",
  "postgres1", "princess", "princess!", "princess1", "princess1!", "princess12",
  "princess12!", "princess123", "princess123!", "princess1234", "princess12345", "princess123456",
  "princess2020", "princess2021", "princess2022", "princess2023", "princess2024", "princess2025",
  "princess2026", "printer", "printer123", "qazwsx", "qazwsx123", "quezon",
  "quezon123", "qweasdzxc", "qweasdzxc1", "qwerty", "qwerty!", "qwerty1",
  "qwerty1!", "qwerty12", "qwerty12!", "qwerty123", "qwerty123!", "qwerty1234",
  "qwerty12345", "qwerty123456", "qwerty2020", "qwerty2021", "qwerty2022", "qwerty2023",
  "qwerty2024", "qwerty2025", "qwerty2026", "qwertyuiop", "ranger", "ranger!",
  "ranger1", "ranger1!", "ranger12", "ranger12!", "ranger123", "ranger123!",
  "ranger1234", "ranger12345", "ranger123456", "ranger2020", "ranger2021", "ranger2022",
  "ranger2023", "ranger2024", "ranger2025", "ranger2026", "realmadrid", "richard",
  "richard123", "robert", "robert123", "root", "root!", "root1",
  "root1!", "root12", "root12!", "root123", "root123!", "root1234",
  "root12345", "root123456", "root2020", "root2021", "root2022", "root2023",
  "root2024", "root2025", "root2026", "rose", "rose12345", "router",
  "router123", "sample", "sample123", "samsung", "samsung123", "sarah",
  "sarah1234", "saturday", "saturday1", "school", "school123", "seams",
  "seams1234", "seamslab", "seamslab1", "secret", "secret!", "secret1",
  "secret1!", "secret12", "secret12!", "secret123", "secret123!", "secret1234",
  "secret12345", "secret123456", "secret2020", "secret2021", "secret2022", "secret2023",
  "secret2024", "secret2025", "secret2026", "security", "security1", "server",
  "server!", "server1", "server1!", "server12", "server12!", "server123",
  "server123!", "server1234", "server12345", "server123456", "server2020", "server2021",
  "server2022", "server2023", "server2024", "server2025", "server2026", "sexy",
  "sexy12345", "shadow", "shadow!", "shadow1", "shadow1!", "shadow12",
  "shadow12!", "shadow123", "shadow123!", "shadow1234", "shadow12345", "shadow123456",
  "shadow2020", "shadow2021", "shadow2022", "shadow2023", "shadow2024", "shadow2025",
  "shadow2026", "smile", "smile1234", "soccer", "soccer!", "soccer1",
  "soccer1!", "soccer12", "soccer12!", "soccer123", "soccer123!", "soccer1234",
  "soccer12345", "soccer123456", "soccer2020", "soccer2021", "soccer2022", "soccer2023",
  "soccer2024", "soccer2025", "soccer2026", "spotify", "spotify123", "spring",
  "spring!", "spring1", "spring1!", "spring12", "spring12!", "spring123",
  "spring123!", "spring1234", "spring12345", "spring123456", "spring2020", "spring2021",
  "spring2022", "spring2023", "spring2024", "spring2025", "spring2026", "starwars",
  "starwars1", "starwars123", "stephanie", "stephanie1", "success", "success123",
  "summer", "summer!", "summer1", "summer1!", "summer12", "summer12!",
  "summer123", "summer123!", "summer1234", "summer12345", "summer123456", "summer2020",
  "summer2021", "summer2022", "summer2023", "summer2024", "summer2025", "summer2026",
  "sunshine", "sunshine!", "sunshine1", "sunshine1!", "sunshine12", "sunshine12!",
  "sunshine123", "sunshine123!", "sunshine1234", "sunshine12345", "sunshine123456", "sunshine2020",
  "sunshine2021", "sunshine2022", "sunshine2023", "sunshine2024", "sunshine2025", "sunshine2026",
  "superman", "superman!", "superman1", "superman1!", "superman12", "superman12!",
  "superman123", "superman123!", "superman1234", "superman12345", "superman123456", "superman2020",
  "superman2021", "superman2022", "superman2023", "superman2024", "superman2025", "superman2026",
  "superuser", "superuser1", "switch", "switch123", "system", "system!",
  "system1", "system1!", "system12", "system12!", "system123", "system123!",
  "system1234", "system12345", "system123456", "system2020", "system2021", "system2022",
  "system2023", "system2024", "system2025", "system2026", "tagaytay", "tagaytay1",
  "tagaytay123", "temp", "temp!", "temp1", "temp1!", "temp12",
  "temp12!", "temp123", "temp123!", "temp1234", "temp12345", "temp123456",
  "temp2020", "temp2021", "temp2022", "temp2023", "temp2024", "temp2025",
  "temp2026", "temporary1", "test", "test!", "test1", "test1!",
  "test12", "test12!", "test123", "test123!", "test1234", "test12345",
  "test123456", "test2020", "test2021", "test2022", "test2023", "test2024",
  "test2025", "test2026", "testing", "testing1", "testing123", "testpass12",
  "thomas", "thomas!", "thomas1", "thomas1!", "thomas12", "thomas12!",
  "thomas123", "thomas123!", "thomas1234", "thomas12345", "thomas123456", "thomas2020",
  "thomas2021", "thomas2022", "thomas2023", "thomas2024", "thomas2025", "thomas2026",
  "tigger", "tigger!", "tigger1", "tigger1!", "tigger12", "tigger12!",
  "tigger123", "tigger123!", "tigger1234", "tigger12345", "tigger123456", "tigger2020",
  "tigger2021", "tigger2022", "tigger2023", "tigger2024", "tigger2025", "tigger2026",
  "trustno1", "trustno12", "tulip", "tulip1234", "user", "user!",
  "user1", "user1!", "user12", "user12!", "user123", "user123!",
  "user1234", "user12345", "user123456", "user2020", "user2021", "user2022",
  "user2023", "user2024", "user2025", "user2026", "wedding", "wedding!",
  "wedding1", "wedding1!", "wedding12", "wedding12!", "wedding123", "wedding123!",
  "wedding1234", "wedding12345", "wedding123456", "wedding2020", "wedding2021", "wedding2022",
  "wedding2023", "wedding2024", "wedding2025", "wedding2026", "welcome", "welcome!",
  "welcome1", "welcome1!", "welcome12", "welcome12!", "welcome123", "welcome123!",
  "welcome1234", "welcome12345", "welcome123456", "welcome2020", "welcome2021", "welcome2022",
  "welcome2023", "welcome2024", "welcome2025", "welcome2026", "whatever", "whatever!",
  "whatever1", "whatever1!", "whatever12", "whatever12!", "whatever123", "whatever123!",
  "whatever1234", "whatever12345", "whatever123456", "whatever2020", "whatever2021", "whatever2022",
  "whatever2023", "whatever2024", "whatever2025", "whatever2026", "william", "william123",
  "windows", "windows123", "winner", "winner123", "winter", "winter!",
  "winter1", "winter1!", "winter12", "winter12!", "winter123", "winter123!",
  "winter1234", "winter12345", "winter123456", "winter2020", "winter2021", "winter2022",
  "winter2023", "winter2024", "winter2025", "winter2026", "xiaomi", "xiaomi123",
  "yankees", "yankees123", "youtube", "youtube123", "zaq12wsx", "zxcv1234",
  "zxcv12345", "zxcvbnm", "zxcvbnm,./", "zxcvbnm123"
]);

const ACL = {
  events: { read: ["owner", "admin"], write: ["owner", "admin"] },
  requests: { read: ["owner", "admin"], write: ["owner", "admin"] },
  schedule: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  tasks: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  attendance: { read: ["owner", "admin", "staff"], write: ["owner", "admin", "staff"] },
  announcements: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  finances: { read: ["owner"], write: ["owner"] },
  users: { read: ["owner"], write: ["owner"] },
  reports: { read: ["owner", "admin"], write: ["owner"] },
  audit: { read: ["owner"], write: ["owner"] },
  sales: { read: ["owner", "admin"], write: ["owner", "admin"] },
  housekeeping: { read: ["owner", "admin", "staff"], write: ["owner", "admin", "staff"] },
  inventory: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  accounting: { read: ["owner"], write: ["owner"] },
  hr: { read: ["owner", "admin"], write: ["owner", "admin"] },
  payroll: { read: ["owner"], write: ["owner"] }
};

const ALLOW_WHILE_PASSWORD_CHANGE = new Set([
  "GET /api/auth/me",
  "POST /api/auth/password",
  "POST /api/auth/logout",
  "POST /api/auth/logout-all"
]);


const demoMemo = new WeakMap();

async function hasSampleRows(env, request) {
  const memo = request ? demoMemo.get(request) : null;
  if (memo && memo.hasSample !== undefined) return memo.hasSample;
  const row = await env.DB.prepare(
    `SELECT CASE WHEN
        EXISTS (SELECT 1 FROM events WHERE IFNULL(is_sample,0)=1)
        OR EXISTS (SELECT 1 FROM payments WHERE IFNULL(is_sample,0)=1)
        OR EXISTS (SELECT 1 FROM expenses WHERE IFNULL(is_sample,0)=1)
        OR EXISTS (SELECT 1 FROM tasks WHERE IFNULL(is_sample,0)=1)
        OR EXISTS (SELECT 1 FROM inventory_items WHERE IFNULL(is_sample,0)=1)
        OR EXISTS (SELECT 1 FROM users WHERE IFNULL(is_sample,0)=1)
      THEN 1 ELSE 0 END AS ok`
  ).first();
  const value = Boolean(row && row.ok);
  if (request) {
    const bag = demoMemo.get(request) || {};
    bag.hasSample = value;
    demoMemo.set(request, bag);
  }
  return value;
}

async function ensureAppSettings(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT,
      updated_by TEXT
    )`
  ).run();
}

async function getDemoMode(env, request) {
  const memo = request ? demoMemo.get(request) : null;
  if (memo && memo.demoMode !== undefined) return memo.demoMode;
  const hasSample = await hasSampleRows(env, request);
  if (!hasSample) {
    if (request) {
      const bag = demoMemo.get(request) || {};
      bag.demoMode = false;
      demoMemo.set(request, bag);
    }
    return false;
  }
  let row = null;
  try {
    row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'demo_mode'").first();
  } catch (_) {
    row = null;
  }
  const value = !row ? true : (row.value === "1" || row.value === "true");
  if (request) {
    const bag = demoMemo.get(request) || {};
    bag.demoMode = value;
    demoMemo.set(request, bag);
  }
  return value;
}

async function setDemoMode(env, on, user) {
  await ensureAppSettings(env);
  const value = on ? "1" : "0";
  const at = isoNow();
  const by = user && user.id ? user.id : null;
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('demo_mode', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
  ).bind(value, at, by).run();
  return value === "1";
}

export {
  HELD_STATUSES,
  allow,
  audit,
  auditStmt,
  getDemoMode,
  hasSampleRows,
  setDemoMode,
  dateVenueTaken,
  deny,
  eventColumns,
  eventsFromSql,
  isoNow,
  json,
  originAllowed,
  randomId,
  readJson,
  todayISO,
  vDate,
  vInt,
  vOneOf,
  vStr
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = request.headers.get("CF-Ray") || randomId();
    try {
      return await handle(request, env, url, requestId);
    } catch (err) {
      console.error(JSON.stringify({
        level: "error",
        requestId,
        path: url.pathname,
        method: request.method,
        message: String(err && err.message ? err.message : err)
      }));
      return json({ error: "Something went wrong. Please try again.", requestId }, 500, request);
    }
  },
  async scheduled(controller, env) {
    try {
      const result = await runScheduledSweeps(env);
      console.log(JSON.stringify({ level: "info", message: "scheduled_sweep", ...result }));
    } catch (err) {
      console.error(JSON.stringify({ level: "error", message: "scheduled_sweep_failed", error: String(err && err.message ? err.message : err) }));
      throw err;
    }
  }
};

async function handle(request, env, url, requestId) {
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true }, 200, request);
  }
  if (url.pathname === "/api/config" && request.method === "GET") {
    return json({ turnstileSiteKey: TURNSTILE_SITE_KEY }, 200, request);
  }
  if (url.pathname === "/api/calendar" && request.method === "GET") {
    return getCalendar(url, env, request);
  }
  if (url.pathname === "/api/requests" && request.method === "POST") {
    return createPublicRequest(request, env);
  }
  if (url.pathname === "/api/auth/setup" && request.method === "POST") {
    return setupOwner(request, env);
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    return login(request, env);
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return logout(request, env);
  }

  const user = await requireUser(request, env);
  if (user instanceof Response) return user;

  if (user.must_change_password) {
    const key = `${request.method} ${url.pathname}`;
    if (!ALLOW_WHILE_PASSWORD_CHANGE.has(key)) {
      return json({
        error: "Please set a new password before continuing.",
        code: "password_change_required"
      }, 403, request);
    }
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return json({ user: publicUser(user) }, 200, request);
  }
  if (url.pathname === "/api/auth/password" && request.method === "POST") {
    return changePassword(request, env, user);
  }
  if (url.pathname === "/api/auth/logout-all" && request.method === "POST") {
    return logoutAll(env, request, user);
  }
  if (url.pathname === "/api/directory" && request.method === "GET") {
    return listDirectory(env, request);
  }

  if (url.pathname === "/api/events" && request.method === "GET") {
    if (!allow(user, "events", "read")) return deny(request);
    return listEvents(env, request, user);
  }
  if (url.pathname === "/api/events" && request.method === "POST") {
    if (!allow(user, "events", "write")) return deny(request);
    return createEvent(request, env, user);
  }
  if (url.pathname.startsWith("/api/events/") && request.method === "PATCH") {
    if (!allow(user, "events", "write")) return deny(request);
    return patchEvent(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/requests" && request.method === "GET") {
    if (!allow(user, "requests", "read")) return deny(request);
    return listRequests(env, request);
  }
  if (url.pathname === "/api/requests/new" && request.method === "POST") {
    if (!allow(user, "requests", "write")) return deny(request);
    return createStaffRequest(request, env, user);
  }
  if (url.pathname.startsWith("/api/requests/") && url.pathname.endsWith("/decide") && request.method === "POST") {
    if (!allow(user, "requests", "write")) return deny(request);
    const id = url.pathname.split("/")[3];
    return decideRequest(id, request, env, user);
  }

  if (url.pathname === "/api/shifts" && request.method === "GET") {
    if (!allow(user, "schedule", "read")) return deny(request);
    return listShifts(env, request, user);
  }
  if (url.pathname === "/api/shifts" && request.method === "POST") {
    if (!allow(user, "schedule", "write")) return deny(request);
    return createShift(request, env, user);
  }
  if (url.pathname.startsWith("/api/shifts/") && request.method === "PATCH") {
    if (!allow(user, "schedule", "write")) return deny(request);
    return patchShift(url.pathname.split("/").pop(), request, env, user);
  }
  if (url.pathname.startsWith("/api/shifts/") && request.method === "DELETE") {
    if (!allow(user, "schedule", "write")) return deny(request);
    return deleteShift(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/tasks" && request.method === "GET") {
    if (!allow(user, "tasks", "read")) return deny(request);
    return listTasks(env, request, user);
  }
  if (url.pathname === "/api/tasks" && request.method === "POST") {
    if (!allow(user, "tasks", "write")) return deny(request);
    return createTask(request, env, user);
  }
  if (url.pathname.startsWith("/api/tasks/") && request.method === "PATCH") {
    return patchTask(url.pathname.split("/").pop(), request, env, user);
  }
  if (url.pathname.startsWith("/api/tasks/") && request.method === "DELETE") {
    if (!allow(user, "tasks", "write")) return deny(request);
    return deleteTask(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/attendance" && request.method === "GET") {
    if (!allow(user, "attendance", "read")) return deny(request);
    return listAttendance(env, request, user);
  }
  if (url.pathname === "/api/attendance/clock" && request.method === "POST") {
    if (!allow(user, "attendance", "write")) return deny(request);
    return clock(env, request, user);
  }
  if (url.pathname.startsWith("/api/attendance/") && request.method === "PATCH") {
    if (user.role === "staff") return deny(request);
    if (!allow(user, "attendance", "write")) return deny(request);
    return patchAttendance(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/announcements" && request.method === "GET") {
    if (!allow(user, "announcements", "read")) return deny(request);
    return listAnnouncements(env, request);
  }
  if (url.pathname === "/api/announcements" && request.method === "POST") {
    if (!allow(user, "announcements", "write")) return deny(request);
    return createAnnouncement(request, env, user);
  }

  if (url.pathname === "/api/finances" && request.method === "GET") {
    if (!allow(user, "finances", "read")) return deny(request);
    return listFinances(env, request);
  }

  if (url.pathname === "/api/reports/export" && request.method === "GET") {
    if (user.role !== "owner" && user.role !== "admin") return deny(request);
    return exportReport(url, env, request, user);
  }

  if (url.pathname === "/api/users" && request.method === "GET") {
    if (!allow(user, "users", "read")) return deny(request);
    return listUsers(env, request);
  }
  if (url.pathname === "/api/users" && request.method === "POST") {
    if (!allow(user, "users", "write")) return deny(request);
    return createUser(request, env, user);
  }
  if (url.pathname.startsWith("/api/users/") && url.pathname.endsWith("/logout") && request.method === "POST") {
    if (!allow(user, "users", "write")) return deny(request);
    return revokeUserSessions(url.pathname.split("/")[3], request, env, user);
  }
  if (url.pathname.startsWith("/api/users/") && request.method === "PATCH") {
    if (!allow(user, "users", "write")) return deny(request);
    return patchUser(url.pathname.split("/")[3], request, env, user);
  }

  if (url.pathname === "/api/sample" && request.method === "GET") {
    if (user.role !== "owner") return deny(request);
    return sampleStatus(env, request);
  }
  if (url.pathname === "/api/sample/remove" && request.method === "POST") {
    if (user.role !== "owner") return deny(request);
    return removeSample(request, env, user);
  }
  if (url.pathname === "/api/sample" && request.method === "DELETE") {
    if (user.role !== "owner") return deny(request);
    return removeSample(request, env, user);
  }
  if (url.pathname === "/api/sample/cleanup-smoke" && request.method === "POST") {
    if (user.role !== "owner") return deny(request);
    return cleanupSmoke(request, env, user);
  }
  if (url.pathname === "/api/audit" && request.method === "GET") {
    if (!allow(user, "audit", "read")) return deny(request);
    return listAudit(env, request);
  }

  const opsResponse = await handleOps(request, env, url, user);
  if (opsResponse) return opsResponse;

  return json({ error: "Not found." }, 404, request);
}

function allow(user, resource, action) {
  const rule = ACL[resource];
  if (!rule) return false;
  return (rule[action] || []).includes(user.role);
}

function deny(request) {
  return json({ error: "You do not have access to this." }, 403, request);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    title: user.title,
    mustChangePassword: Boolean(user.must_change_password),
    isSample: Boolean(user.is_sample),
    isActive: user.is_active !== 0
  };
}

function originAllowed(request) {
  const origin = request.headers.get("Origin") || "";
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  };
}

function cors(response, request) {
  const headers = corsHeaders(request);
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) next.headers.set(key, value);
  return next;
}

function json(body, status, request) {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    }),
    request
  );
}

function fileResponse(body, filename, type, request) {
  return cors(
    new Response(body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    }),
    request
  );
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function nowTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date());
}

function isoNow() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomUUID();
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(hash);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return bytesToHex(bits);
}

function newSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

function validPassword(password) {
  if (typeof password !== "string" || password.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Use both letters and numbers.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Please choose a less common password.";
  return null;
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  return match ? match[1] : "";
}

function clientIp(request) {
  const ip = (request.headers.get("CF-Connecting-IP") || "").trim();
  if (ip) return ip;
  const ray = request.headers.get("CF-Ray") || "";
  const country = request.headers.get("CF-IPCountry") || "";
  const ua = request.headers.get("User-Agent") || "";
  return `noip:${country}:${(ray || ua).slice(0, 24)}`;
}

function vStr(value, { label, min = 1, max = 200, required = true } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return required ? { error: `Please enter ${label}.` } : { value: "" };
  if (text.length < min || text.length > max) return { error: `${label[0].toUpperCase()}${label.slice(1)} must be at most ${max} characters.` };
  return { value: text };
}

function vInt(value, { label, min = 0, max = 100000000, required = true, allowNull = false } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowNull || !required) return { value: null };
    return { error: `Please enter ${label}.` };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `${label[0].toUpperCase()}${label.slice(1)} must be a whole number from ${min} to ${max}.` };
  }
  return { value: n };
}

function vDate(value, { label = "the date", required = true } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return required ? { error: `Please enter ${label}.` } : { value: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `Please enter a valid ${label}.` };
  const [y, m, d] = text.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    return { error: `Please enter a valid ${label}.` };
  }
  return { value: text };
}

function vTime(value, label = "the time") {
  const text = String(value ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return { error: `Please enter a valid ${label}.` };
  const [h, m] = text.split(":").map(Number);
  if (h > 23 || m > 59) return { error: `Please enter a valid ${label}.` };
  return { value: text };
}

function vOneOf(value, options, label) {
  if (!options.includes(value)) return { error: `Please pick a valid ${label}.` };
  return { value };
}

function vContact(value) {
  const text = String(value ?? "").trim();
  if (!text) return { error: "Please enter a valid email or Philippine mobile number." };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 80) return { value: text };
  const digits = text.replace(/[^\d+]/g, "");
  if (/^(?:\+?63|0)9\d{9}$/.test(digits)) return { value: text };
  return { error: "Please enter a valid email or Philippine mobile number." };
}

function vEmail(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || text.length > 120) {
    return { error: "Please enter a valid email." };
  }
  return { value: text };
}

async function assertActiveStaff(env, staffId) {
  const staff = await env.DB.prepare("SELECT id, is_active FROM users WHERE id = ?").bind(staffId).first();
  if (!staff) return "Staff member not found.";
  if (!staff.is_active) return "That staff account is no longer active.";
  return null;
}

async function assertExistingEvent(env, eventId) {
  if (!eventId) return null;
  const event = await env.DB.prepare("SELECT id FROM events WHERE id = ?").bind(eventId).first();
  if (!event) return "Event not found.";
  return null;
}

function normalizeEventStatus(value) {
  if (!value) return "Confirmed";
  const found = EVENT_STATUSES.find((item) => item.toLowerCase() === String(value).trim().toLowerCase());
  return found || null;
}

function isPlainNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function csvEscape(value) {
  if (isPlainNumber(value)) return String(value);
  let text = value === null || value === undefined ? "" : String(value);
  if (/^-?\d+(\.\d+)?$/.test(text.trim())) return text.trim();
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows, columns) {
  const header = columns.map((col) => csvEscape(col.label)).join(",");
  const lines = (rows || []).map((row) => columns.map((col) => csvEscape(row[col.key])).join(","));
  return `\uFEFF${header}\n${lines.join("\n")}\n`;
}


function crc32Bytes(bytes) {
  let crc = 0xFFFFFFFF;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16le(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data || ""));
    const crc = crc32Bytes(data);
    const local = concatBytes([
      u32le(0x04034b50), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(crc), u32le(data.length), u32le(data.length), u16le(name.length), u16le(0),
      name, data
    ]);
    const central = concatBytes([
      u32le(0x02014b50), u16le(20), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(crc), u32le(data.length), u32le(data.length), u16le(name.length), u16le(0), u16le(0),
      u16le(0), u16le(0), u32le(0), u32le(offset), name
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const localAll = concatBytes(locals);
  const centralAll = concatBytes(centrals);
  const end = concatBytes([
    u32le(0x06054b50), u16le(0), u16le(0), u16le(files.length), u16le(files.length),
    u32le(centralAll.length), u32le(localAll.length), u16le(0)
  ]);
  return concatBytes([localAll, centralAll, end]);
}

function xlsxEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toXlsx(rows, columns, sheetName) {
  const safeName = String(sheetName || "Sheet1").replace(/[\\/*?:\[\]]/g, " ").slice(0, 31) || "Sheet1";
  const cellXml = (rowIndex, colIndex, raw, col) => {
    const ref = `${String.fromCharCode(65 + (colIndex % 26))}${rowIndex}`;
    if (isPlainNumber(raw) || (col && col.type === "number" && raw !== null && raw !== undefined && raw !== "")) {
      const n = Number(raw);
      if (Number.isFinite(n)) return `<c r="${ref}" t="n"><v>${n}</v></c>`;
    }
    let text = String(raw ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xlsxEscape(text)}</t></is></c>`;
  };
  const header = `<row r="1">${columns.map((col, i) => cellXml(1, i, col.label)).join("")}</row>`;
  const body = (rows || []).map((row, r) => {
    const rowIndex = r + 2;
    return `<row r="${rowIndex}">${columns.map((col, i) => cellXml(rowIndex, i, row[col.key], col)).join("")}</row>`;
  }).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${header}${body}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xlsxEscape(safeName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const encoder = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: encoder.encode(types) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) }
  ]);
}

function toExcelXml(rows, columns, sheetName) {
  const header = columns.map((col) => `<Cell><Data ss:Type="String">${xmlEscape(col.label)}</Data></Cell>`).join("");
  const body = (rows || []).map((row) => {
    const cells = columns.map((col) => {
      const value = row[col.key];
      if (isPlainNumber(value) || (col.type === "number" && value !== null && value !== undefined && value !== "")) {
        const n = Number(value);
        if (Number.isFinite(n)) return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
      }
      return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xmlEscape(sheetName)}"><Table><Row>${header}</Row>${body}</Table></Worksheet>
</Workbook>`;
}

function xmlEscape(value) {
  if (isPlainNumber(value)) return String(value);
  let text = String(value ?? "");
  if (/^-?\d+(\.\d+)?$/.test(text.trim())) return text.trim();
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function sampleFromActor(user, parent) {
  if (parent && (parent.is_sample === 1 || parent.is_sample === true)) return 1;
  if (user && (user.is_sample === 1 || user.is_sample === true)) return 1;
  return 0;
}

async function audit(env, user, action, entity, entityId, detail, request, isSample) {
  const sample = isSample === undefined || isSample === null ? sampleFromActor(user) : (isSample ? 1 : 0);
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (id, at, user_id, role, action, entity, entity_id, detail, ip, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      randomId(),
      isoNow(),
      user && user.id ? user.id : null,
      user && user.role ? user.role : null,
      action,
      entity,
      entityId || null,
      detail ? String(detail).slice(0, 2000) : null,
      request ? clientIp(request) : null,
      sample
    ).run();
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "audit_failed", error: String(err && err.message ? err.message : err) }));
    throw err;
  }
}

function auditStmt(env, user, action, entity, entityId, detail, request, isSample) {
  const sample = isSample === undefined || isSample === null ? sampleFromActor(user) : (isSample ? 1 : 0);
  return env.DB.prepare(
    `INSERT INTO audit_log (id, at, user_id, role, action, entity, entity_id, detail, ip, is_sample)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    randomId(),
    isoNow(),
    user && user.id ? user.id : null,
    user && user.role ? user.role : null,
    action,
    entity,
    entityId || null,
    detail ? String(detail).slice(0, 2000) : null,
    request ? clientIp(request) : null,
    sample
  );
}

async function expirePendings(env) {
  const cutoff = new Date(Date.now() - PENDING_DAYS * 86400 * 1000).toISOString();
  const result = await env.DB.prepare(
    "UPDATE requests SET status = 'expired' WHERE status = 'pending' AND created_at < ?"
  ).bind(cutoff).run();
  return (result && result.meta && result.meta.changes) || 0;
}

async function completePastEvents(env) {
  const today = todayISO();
  const result = await env.DB.prepare(
    `UPDATE events SET status = 'Completed'
     WHERE date < ? AND status IN ('Confirmed', 'Setup', 'Booked')`
  ).bind(today).run();
  return (result && result.meta && result.meta.changes) || 0;
}

async function runScheduledSweeps(env) {
  const expired = await expirePendings(env);
  const completed = await completePastEvents(env);
  const now = isoNow();
  await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start) VALUES ('sweep:last', 1, ?)
     ON CONFLICT(key) DO UPDATE SET count = count + 1, window_start = excluded.window_start`
  ).bind(now).run();
  if (expired || completed) {
    await audit(env, { id: "system", role: "system" }, "sweep", "system", null, `Expired ${expired} pending request(s); completed ${completed} past event(s).`, null, 0);
  }
  return { expired, completed, lastSweepAt: now };
}

async function dateVenueTaken(env, date, venue, exceptId, isSample = 0) {
  const venueValue = venue || "Any";
  const except = exceptId || "";
  const sampleFlag = isSample ? 1 : 0;
  if (venueValue === "Any") {
    return env.DB.prepare(
      `SELECT id FROM events
       WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
         AND IFNULL(is_sample, 0) = ? AND id != ?
       LIMIT 1`
    ).bind(date, sampleFlag, except).first();
  }
  return env.DB.prepare(
    `SELECT id FROM events
     WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
       AND IFNULL(is_sample, 0) = ? AND (venue = ? OR venue = 'Any') AND id != ?
     LIMIT 1`
  ).bind(date, sampleFlag, venueValue, except).first();
}

async function bumpFailLimit(env, key, max) {
  const windowStart = String(Math.floor(Date.now() / (LOGIN_WINDOW_MINUTES * 60 * 1000)));
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).bind(key, windowStart).first();
  const count = Number(row && row.count) || 1;
  return { count, blocked: count > max };
}

async function postHourLimit(env, key, max) {
  const hour = isoNow().slice(0, 13);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).bind(key, hour).first();
  const count = Number(row && row.count) || 1;
  return count <= max;
}

async function verifyTurnstile(env, request, token) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return { ok: false, error: "Booking checks are not ready. Please try again in a few minutes." };
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", String(token || ""));
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!data.success) return { ok: false, error: "Please confirm you are not a robot, then send again." };
  return { ok: true };
}

async function requireUser(request, env) {
  const token = bearerToken(request);
  if (!token) return json({ error: "Please sign in.", code: "unauthenticated" }, 401, request);
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, s.created_at AS session_created_at,
            u.id, u.email, u.name, u.role, u.title, u.must_change_password, u.password_set_at,
            u.is_sample, u.is_active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  ).bind(tokenHash).first();
  if (!row) return json({ error: "Please sign in.", code: "unauthenticated" }, 401, request);
  if (row.expires_at < isoNow()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(row.session_id).run();
    return json({ error: "Your session has ended. Please sign in again.", code: "session_expired" }, 401, request);
  }
  const lastSeen = Date.parse(row.last_seen_at || row.session_created_at || 0);
  if (Number.isFinite(lastSeen) && Date.now() - lastSeen > SESSION_IDLE_DAYS * 86400 * 1000) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(row.session_id).run();
    return json({ error: "Your session has ended. Please sign in again.", code: "session_expired" }, 401, request);
  }
  if (row.is_active === 0) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.id).run();
    return json({ error: "This account is no longer active.", code: "inactive" }, 403, request);
  }
  if (!row.last_seen_at || Date.now() - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
    await env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(isoNow(), row.session_id).run();
  }
  return row;
}

async function createSession(env, userId) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const id = randomId();
  const now = isoNow();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, tokenHash, userId, now, expiresAt, now).run();
  return { token, expiresAt };
}

async function revokeSessions(env, userId, exceptSessionId) {
  if (exceptSessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").bind(userId, exceptSessionId).run();
    return;
  }
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

async function getCalendar(url, env, request) {
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const thisYear = Number(todayISO().slice(0, 4));
  if (!Number.isInteger(year) || year < thisYear - 2 || year > thisYear + 5 || month < 1 || month > 12) {
    return json({ error: "Please pick a valid month." }, 400, request);
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  const events = await env.DB.prepare(
    `SELECT date, status FROM events
     WHERE date >= ? AND date < ? AND IFNULL(is_sample, 0) = 0`
  ).bind(start, end).all();
  const days = {};
  for (const event of events.results || []) {
    if (HELD_STATUSES.has(event.status)) days[event.date] = "booked";
  }
  return json({ year, month, days }, 200, request);
}

async function dateStatus(env, iso) {
  const booked = await env.DB.prepare(
    `SELECT 1 FROM events
     WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
       AND IFNULL(is_sample, 0) = 0
     LIMIT 1`
  ).bind(iso).first();
  return booked ? "booked" : "available";
}

async function createPublicRequest(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const ip = clientIp(request);
  if (!(await postHourLimit(env, `req:${ip}`, MAX_PUBLIC_POSTS_PER_HOUR))) {
    return json({ error: "Please wait a little before sending another request." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  if (String(body.company || body.website || "").trim()) {
    return json({ error: "Please complete the form." }, 400, request);
  }
  const turned = await verifyTurnstile(env, request, body.turnstileToken);
  if (!turned.ok) return json({ error: turned.error }, 400, request);
  const date = vDate(body.date, { label: "the date" });
  const name = vStr(body.name, { label: "your name", max: 80 });
  const contact = vContact(body.contact);
  const type = vOneOf(String(body.type || "").trim(), EVENT_TYPES, "event type");
  const venue = vOneOf(String(body.venue || "Any").trim(), VENUES, "venue");
  const pax = vInt(body.pax, { label: "the number of guests", min: 1, max: 500 });
  const notes = vStr(body.notes, { label: "notes", required: false, max: 500 });
  const pkg = vStr(body.package, { label: "package", required: false, max: 80 });
  for (const field of [date, name, contact, type, venue, pax, notes, pkg]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  if (date.value < todayISO()) {
    return json({ error: "Please pick a future available date." }, 400, request);
  }
  if (await dateStatus(env, date.value) === "booked") {
    return json({ error: "That date is no longer available. Please pick another." }, 409, request);
  }
  const pendingCount = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM requests WHERE date = ? AND status = 'pending' AND IFNULL(is_sample, 0) = 0"
  ).bind(date.value).first();
  if (Number(pendingCount && pendingCount.n) >= PENDING_PER_DATE) {
    return json({ error: "Too many requests are already waiting for that date. Please pick another day or try again later." }, 429, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO requests (id, date, name, contact, type, pax, venue, notes, package, status, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0)`
    ).bind(id, date.value, name.value, contact.value, type.value, pax.value, venue.value, notes.value, pkg.value, isoNow()),
    auditStmt(env, { id: "public", role: "public" }, "create", "requests", id, `${date.value} ${venue.value} ${type.value}`, request, 0)
  ]);
  return json({ ok: true, id, date: date.value, status: "pending" }, 201, request);
}

async function setupOwner(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (!(await postHourLimit(env, `setup:${clientIp(request)}`, 8))) {
    return json({ error: "Please wait a little and try again." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const token = String(body.token || "").trim();
  const name = vStr(body.name, { label: "your name", max: 80 });
  const email = vEmail(body.email);
  const password = String(body.password || "");
  if (!token) return json({ error: "Please enter your name, email, and the setup code." }, 400, request);
  if (name.error) return json({ error: name.error }, 400, request);
  if (email.error) return json({ error: email.error }, 400, request);
  const pwdError = validPassword(password);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const tokenHash = await sha256Hex(token);
  const now = isoNow();
  const used = await env.DB.prepare(
    `UPDATE setup_tokens
     SET used_at = ?
     WHERE purpose = 'owner_setup' AND used_at IS NULL AND expires_at >= ? AND token_hash = ?
     RETURNING id`
  ).bind(now, now, tokenHash).first();
  if (!used) {
    return json({ error: "That setup code is not valid or has already been used." }, 400, request);
  }
  const existingOwner = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' AND password_hash IS NOT NULL").first();
  if (existingOwner) {
    return json({ error: "The owner account has already been set up. Please sign in." }, 409, request);
  }
  const salt = newSalt();
  const hash = await hashPassword(password, salt);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner'").first();
  const id = existing ? existing.id : randomId();
  if (existing) {
    await env.DB.prepare(
      `UPDATE users SET email = ?, name = ?, title = 'Owner', password_hash = ?, password_salt = ?, password_set_at = ?, must_change_password = 0, is_active = 1, password_algo = ? WHERE id = ?`
    ).bind(email.value, name.value, hash, salt, now, PASSWORD_ALGO, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, role, title, password_hash, password_salt, password_set_at, must_change_password, is_active, created_at, password_algo)
       VALUES (?, ?, ?, 'owner', 'Owner', ?, ?, ?, 0, 1, ?, ?)`
    ).bind(id, email.value, name.value, hash, salt, now, now, PASSWORD_ALGO).run();
  }
  const session = await createSession(env, id);
  try { await audit(env, { id, role: "owner" }, "setup", "users", id, "Owner account created", request, 0); } catch (_) {}
  return json({
    ok: true,
    user: { id, email: email.value, name: name.value, role: "owner", title: "Owner", mustChangePassword: false },
    token: session.token,
    expiresAt: session.expiresAt
  }, 200, request);
}

async function login(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ipKey = `loginfail:ip:${clientIp(request)}`;
  const acctKey = `loginfail:acct:${email || "blank"}`;
  const ipState = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(ipKey).first();
  const acctState = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(acctKey).first();
  const windowStart = String(Math.floor(Date.now() / (LOGIN_WINDOW_MINUTES * 60 * 1000)));
  const ipCount = ipState && ipState.window_start === windowStart ? Number(ipState.count) : 0;
  const acctCount = acctState && acctState.window_start === windowStart ? Number(acctState.count) : 0;
  const needTurnstile = ipCount >= LOGIN_TURNSTILE_AFTER || acctCount >= LOGIN_TURNSTILE_AFTER;
  if (ipCount >= LOGIN_MAX_PER_IP || acctCount >= LOGIN_MAX_PER_ACCOUNT) {
    return json({ error: "Too many tries. Please wait 15 minutes and try again.", code: "locked" }, 429, request);
  }
  if (needTurnstile) {
    const turned = await verifyTurnstile(env, request, body.turnstileToken);
    if (!turned.ok) {
      return json({ error: turned.error, code: "turnstile_required" }, 401, request);
    }
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const dummySalt = "00".repeat(16);
  const hash = user && user.password_hash && user.password_salt
    ? await hashPassword(password, user.password_salt)
    : await hashPassword(password, dummySalt);
  const ok = user && user.password_hash && timingSafeEqual(user.password_hash, hash);
  if (!ok) {
    const ipFail = await bumpFailLimit(env, ipKey, LOGIN_MAX_PER_IP);
    const acctFail = await bumpFailLimit(env, acctKey, LOGIN_MAX_PER_ACCOUNT);
    const nextNeed = ipFail.count >= LOGIN_TURNSTILE_AFTER || acctFail.count >= LOGIN_TURNSTILE_AFTER;
    if (ipFail.blocked || acctFail.blocked) {
      try { await audit(env, user || null, "login_failed", "users", user && user.id, "locked", request, sampleFromActor(user)); } catch (_) {}
      return json({ error: "Too many tries. Please wait 15 minutes and try again.", code: "locked" }, 429, request);
    }
    try { await audit(env, user || null, "login_failed", "users", user && user.id, email ? "email provided" : "blank email", request, sampleFromActor(user)); } catch (_) {}
    return json({
      error: "Email or password is not right.",
      code: nextNeed ? "turnstile_required" : "auth_failed"
    }, 401, request);
  }
  if (user.is_active === 0) {
    return json({ error: "This account is no longer active.", code: "inactive" }, 403, request);
  }
  if (user.must_change_password && user.password_set_at) {
    const age = Date.now() - Date.parse(user.password_set_at);
    if (Number.isFinite(age) && age > TEMP_PASSWORD_HOURS * 3600 * 1000) {
      return json({
        error: "This temporary password has expired. Ask the owner to set a new one.",
        code: "temp_password_expired"
      }, 403, request);
    }
  }
  const session = await createSession(env, user.id);
  try { await audit(env, user, "login", "sessions", user.id, "Signed in", request, sampleFromActor(user)); } catch (_) {}
  return json({ ok: true, user: publicUser(user), token: session.token, expiresAt: session.expiresAt }, 200, request);
}

async function logout(request, env) {
  const token = bearerToken(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({ ok: true }, 200, request);
}

async function logoutAll(env, request, user) {
  await revokeSessions(env, user.id);
  await audit(env, user, "logout_all", "sessions", user.id, "Signed out everywhere", request);
  return json({ ok: true }, 200, request);
}

async function changePassword(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter your current and new password." }, 400, request);
  const current = String(body.current || "");
  const next = String(body.next || "");
  const pwdError = validPassword(next);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const hash = row && row.password_salt ? await hashPassword(current, row.password_salt) : "";
  if (!row || !timingSafeEqual(row.password_hash || "", hash)) {
    return json({ error: "Your current password is not right." }, 400, request);
  }
  const salt = newSalt();
  const nextHash = await hashPassword(next, salt);
  const now = isoNow();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, password_set_at = ?, must_change_password = 0, password_algo = ? WHERE id = ?"
    ).bind(nextHash, salt, now, PASSWORD_ALGO, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    auditStmt(env, user, "password_change", "users", user.id, "Password changed; sessions revoked", request)
  ]);
  const session = await createSession(env, user.id);
  return json({ ok: true, token: session.token, expiresAt: session.expiresAt }, 200, request);
}

function eventColumns(role) {
  const base = "e.id, e.date, e.client, e.title, e.type, e.package, e.pax, e.venue, e.status, e.from_request, e.created_at, e.created_by, e.is_sample";
  if (role === "owner") return `${base}, e.fee, e.deposit, e.contract_total, IFNULL(b.collected, 0) AS collected, IFNULL(b.balance, 0) AS balance`;
  return base;
}

function eventsFromSql(role) {
  return `SELECT ${eventColumns(role)} FROM events e LEFT JOIN v_event_balance b ON b.event_id = e.id`;
}

async function listEvents(env, request, user) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const range = url.searchParams.get("range") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
  let sql = eventsFromSql(user.role);
  const clauses = [];
  const params = [];
  if (status && EVENT_STATUSES.includes(status)) {
    clauses.push("e.status = ?");
    params.push(status);
  }
  const today = todayISO();
  if (range === "upcoming") {
    clauses.push("e.date >= ?");
    params.push(today);
  } else if (range === "past") {
    clauses.push("e.date < ?");
    params.push(today);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("e.date >= ?"); params.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("e.date <= ?"); params.push(to); }
  if (q) {
    clauses.push("(LOWER(IFNULL(e.client,'')) LIKE ? OR LOWER(IFNULL(e.title,'')) LIKE ? OR LOWER(IFNULL(e.venue,'')) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY e.date ASC LIMIT ?";
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ events: results || [] }, 200, request);
}

function readEventBody(body, { partial = false, role = "owner" } = {}) {
  const out = {};
  if (!partial || body.date !== undefined) {
    const date = vDate(body.date, { label: "the date" });
    if (date.error) return date;
    out.date = date.value;
  }
  if (!partial || body.client !== undefined) {
    const client = vStr(body.client, { label: "the client name", max: 120 });
    if (client.error) return client;
    out.client = client.value;
  }
  if (!partial || body.title !== undefined) {
    const title = vStr(body.title, { label: "the title", max: 160 });
    if (title.error) return title;
    out.title = title.value;
  }
  if (!partial || body.type !== undefined) {
    const type = vOneOf(String(body.type || "").trim(), EVENT_TYPES, "event type");
    if (type.error) return type;
    out.type = type.value;
  }
  if (!partial || body.package !== undefined) {
    const pkg = vStr(body.package, { label: "the package", required: false, max: 80 });
    if (pkg.error) return pkg;
    out.package = pkg.value;
  }
  if (!partial || body.pax !== undefined) {
    const pax = vInt(body.pax, { label: "the guest count", min: 0, max: 2000, required: false, allowNull: true });
    if (pax.error) return pax;
    out.pax = pax.value;
  }
  if (!partial || body.venue !== undefined) {
    const venue = vOneOf(String(body.venue || "Any").trim(), VENUES, "venue");
    if (venue.error) return venue;
    out.venue = venue.value;
  }
  if (!partial || body.status !== undefined) {
    const status = normalizeEventStatus(body.status);
    if (!status) return { error: "Please pick a valid status." };
    out.status = status;
  }
  if (body.fee !== undefined || body.deposit !== undefined) {
    if (role !== "owner") return { error: "Only the owner can set fees and deposits." };
  }
  if (role === "owner" && (!partial || body.fee !== undefined)) {
    const fee = vInt(body.fee, { label: "the fee", min: 0, max: 100000000, required: false, allowNull: true });
    if (fee.error) return fee;
    out.fee = fee.value;
  }
  if (role === "owner" && (!partial || body.deposit !== undefined)) {
    const deposit = vInt(body.deposit, { label: "the deposit", min: 0, max: 100000000, required: false, allowNull: true });
    if (deposit.error) return deposit;
    out.deposit = deposit.value;
  }
  return { value: out };
}

async function createEvent(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter a date." }, 400, request);
  const parsed = readEventBody(body, { role: user.role });
  if (parsed.error) return json({ error: parsed.error }, 400, request);
  const ev = parsed.value;
  ev.status = ev.status || "Confirmed";
  if (HELD_STATUSES.has(ev.status)) {
    const taken = await dateVenueTaken(env, ev.date, ev.venue, null, ev.is_sample || (user && user.is_sample));
    if (taken) return json({ error: "That date and venue are already held by another event." }, 409, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, ev.date, ev.client, ev.title, ev.type, ev.package || "", ev.pax, ev.venue, ev.status, ev.fee, ev.deposit, isoNow(), user.id),
    auditStmt(env, user, "create", "events", id, `${ev.date} ${ev.client}`, request)
  ]);
  const event = await env.DB.prepare(`${eventsFromSql(user.role)} WHERE e.id = ?`).bind(id).first();
  return json({ event }, 201, request);
}

async function patchEvent(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Event not found." }, 404, request);
  const parsed = readEventBody(body, { partial: true, role: user.role });
  if (parsed.error) return json({ error: parsed.error }, 400, request);
  const ev = parsed.value;
  const nextDate = ev.date || existing.date;
  const nextVenue = ev.venue || existing.venue;
  const nextStatus = ev.status || existing.status;
  if (HELD_STATUSES.has(nextStatus)) {
    const taken = await dateVenueTaken(env, nextDate, nextVenue, id, existing.is_sample);
    if (taken) return json({ error: "That date and venue are already held by another event." }, 409, request);
  }
  const fields = Object.keys(ev);
  if (!fields.length) {
    const event = await env.DB.prepare(`${eventsFromSql(user.role)} WHERE e.id = ?`).bind(id).first();
    return json({ event }, 200, request);
  }
  const sets = fields.map((field) => `${field} = ?`);
  const values = fields.map((field) => ev[field]);
  values.push(id);
  await env.DB.batch([
    env.DB.prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`).bind(...values),
    auditStmt(env, user, ev.status === "Cancelled" ? "cancel" : "update", "events", id, JSON.stringify(ev), request, existing.is_sample)
  ]);
  const event = await env.DB.prepare(`${eventsFromSql(user.role)} WHERE e.id = ?`).bind(id).first();
  return json({ event }, 200, request);
}

async function listRequests(env, request) {
  const { results } = await env.DB.prepare(
    `SELECT id, date, name, contact, type, package, pax, venue, notes, status, created_at, decided_at, decided_by, is_sample, decline_reason
     FROM requests
     ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'declined' THEN 2 ELSE 3 END, date ASC
     LIMIT 500`
  ).all();
  return json({ requests: results || [] }, 200, request);
}

async function createStaffRequest(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const date = vDate(body.date, { label: "the date" });
  const name = vStr(body.name, { label: "the name", max: 80 });
  const contact = vContact(body.contact || "09170000000");
  const type = vOneOf(String(body.type || "Other").trim(), EVENT_TYPES, "event type");
  const venue = vOneOf(String(body.venue || "Any").trim(), VENUES, "venue");
  const pax = vInt(body.pax, { label: "the number of guests", min: 1, max: 500, required: false });
  const notes = vStr(body.notes, { label: "notes", required: false, max: 500 });
  const pkg = vStr(body.package, { label: "package", required: false, max: 80 });
  for (const field of [date, name, contact, type, venue, pax, notes, pkg]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const sample = sampleFromActor(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO requests (id, date, name, contact, type, pax, venue, notes, package, status, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(id, date.value, name.value, contact.value, type.value, pax.value || 50, venue.value, notes.value, pkg.value, isoNow(), sample),
    auditStmt(env, user, "create", "requests", id, `${date.value} ${venue.value}`, request, sample)
  ]);
  const row = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  return json({ request: row }, 201, request);
}

async function decideRequest(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const decision = body && body.decision;
  if (decision !== "approved" && decision !== "declined") {
    return json({ error: "Please approve or decline this request." }, 400, request);
  }
  let reason = "";
  if (decision === "declined") {
    const parsed = vStr(body.reason || body.decline_reason, { label: "a reason", min: 3, max: 500 });
    if (parsed.error) return json({ error: "Please enter a reason for declining." }, 400, request);
    reason = parsed.value;
  }
  const req = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  if (!req || req.status !== "pending") return json({ error: "This request is no longer pending." }, 409, request);
  const now = isoNow();
  if (decision === "approved") {
    const taken = await dateVenueTaken(env, req.date, req.venue, null, req.is_sample);
    if (taken) return json({ error: "That date and venue are already held by another event." }, 409, request);
    const eventId = randomId();
    try {
      const results = await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, from_request, created_at, created_by, is_sample)
           SELECT ?, date, name, COALESCE(NULLIF(type, ''), 'Booking request'), type, COALESCE(package, 'From booking request'), pax, COALESCE(NULLIF(venue, ''), 'Any'), 'Confirmed', NULL, NULL, id, ?, ?, IFNULL(is_sample, 0)
           FROM requests
           WHERE id = ? AND status = 'pending'
             AND NOT EXISTS (
               SELECT 1 FROM events e
               WHERE e.date = requests.date
                 AND e.status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
                 AND IFNULL(e.is_sample, 0) = IFNULL(requests.is_sample, 0)
                 AND (
                   CASE
                     WHEN IFNULL(requests.venue, '') IN ('', 'Any') THEN 1
                     WHEN e.venue = requests.venue OR e.venue = 'Any' THEN 1
                     ELSE 0
                   END
                 ) = 1
             )`
        ).bind(eventId, now, user.id, id),
        env.DB.prepare(
          `UPDATE requests SET status = 'approved', decided_at = ?, decided_by = ?, decline_reason = NULL
           WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM events e WHERE e.from_request = requests.id)`
        ).bind(now, user.id, id)
      ]);
      const inserted = results[0] && results[0].meta && results[0].meta.changes;
      if (inserted !== 1) return json({ error: "That date and venue are already held by another event, or this request is no longer pending." }, 409, request);
      try {
        await audit(env, user, "approve", "requests", id, `Created event ${eventId}`, request, req.is_sample);
      } catch (err) {
        console.error(JSON.stringify({ level: "error", message: "approve_audit_failed", error: String(err && err.message ? err.message : err) }));
      }
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      if (/UNIQUE constraint failed/i.test(message)) {
        return json({ error: "This request is no longer pending." }, 409, request);
      }
      throw err;
    }
  } else {
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE requests SET status = 'declined', decided_at = ?, decided_by = ?, decline_reason = ? WHERE id = ? AND status = 'pending'"
      ).bind(now, user.id, reason, id),
      auditStmt(env, user, "decline", "requests", id, reason, request, req.is_sample)
    ]);
    const changes = results[0] && results[0].meta && results[0].meta.changes;
    if (changes !== 1) return json({ error: "This request is no longer pending." }, 409, request);
  }
  const updated = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  return json({ request: updated }, 200, request);
}

async function listDirectory(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, role, title, is_sample FROM users WHERE IFNULL(is_active, 1) = 1 AND role != 'owner' ORDER BY name ASC"
  ).all();
  return json({ people: results || [] }, 200, request);
}

async function listShifts(env, request, user) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const clauses = [];
  const params = [];
  if (user.role === "staff") {
    clauses.push("shifts.staff_id = ?");
    params.push(user.id);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("shifts.date >= ?"); params.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("shifts.date <= ?"); params.push(to); }
  let sql = `SELECT shifts.*, u.name AS staff_name, e.title AS event_title, e.venue AS event_venue, e.client AS event_client
             FROM shifts
             LEFT JOIN users u ON u.id = shifts.staff_id
             LEFT JOIN events e ON e.id = shifts.event_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY shifts.date ASC, shifts.start ASC LIMIT 500";
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ shifts: results || [] }, 200, request);
}

async function createShift(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter the date, staff member, and time." }, 400, request);
  const date = vDate(body.date, { label: "the date" });
  const staffId = vStr(body.staffId, { label: "the staff member", max: 80 });
  const start = vTime(body.start, "start time");
  const end = vTime(body.end, "end time");
  const role = vStr(body.role, { label: "the assignment", required: false, max: 80 });
  const eventId = vStr(body.eventId, { label: "the event", required: false, max: 80 });
  for (const field of [date, staffId, start, end, role, eventId]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const staffError = await assertActiveStaff(env, staffId.value);
  if (staffError) return json({ error: staffError }, 400, request);
  const eventError = await assertExistingEvent(env, eventId.value || null);
  if (eventError) return json({ error: eventError }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO shifts (id, date, staff_id, start, end, role, event_id, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, date.value, staffId.value, start.value, end.value, role.value, eventId.value || null, isoNow()),
    auditStmt(env, user, "create", "shifts", id, `${date.value} ${staffId.value}`, request)
  ]);
  const shift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  return json({ shift }, 201, request);
}

async function patchShift(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body || typeof body !== "object") return json({ error: "Please send the details as JSON." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Shift not found." }, 404, request);
  const fields = {};
  if (body.date !== undefined) {
    const date = vDate(body.date, { label: "the date" });
    if (date.error) return json({ error: date.error }, 400, request);
    fields.date = date.value;
  }
  if (body.staffId !== undefined) {
    const staffId = vStr(body.staffId, { label: "the staff member", max: 80 });
    if (staffId.error) return json({ error: staffId.error }, 400, request);
    const staffError = await assertActiveStaff(env, staffId.value);
    if (staffError) return json({ error: staffError }, 400, request);
    fields.staff_id = staffId.value;
  }
  if (body.role !== undefined) {
    const role = vStr(body.role, { label: "the assignment", required: false, max: 80 });
    if (role.error) return json({ error: role.error }, 400, request);
    fields.role = role.value;
  }
  if (body.eventId !== undefined) {
    const eventError = await assertExistingEvent(env, body.eventId || null);
    if (eventError) return json({ error: eventError }, 400, request);
    fields.event_id = body.eventId || null;
  }
  if (body.start !== undefined) {
    const start = vTime(body.start, "start time");
    if (start.error) return json({ error: start.error }, 400, request);
    fields.start = start.value;
  }
  if (body.end !== undefined) {
    const end = vTime(body.end, "end time");
    if (end.error) return json({ error: end.error }, 400, request);
    fields.end = end.value;
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ shift: existing }, 200, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE shifts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "shifts", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  const shift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  return json({ shift }, 200, request);
}

async function deleteShift(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Shift not found." }, 404, request);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM shifts WHERE id = ?").bind(id),
    auditStmt(env, user, "delete", "shifts", id, existing.date, request, existing.is_sample)
  ]);
  return json({ ok: true }, 200, request);
}

async function listTasks(env, request, user) {
  const clauses = [];
  const params = [];
  if (user.role === "staff") {
    clauses.push("tasks.staff_id = ?");
    params.push(user.id);
  }
  let sql = `SELECT tasks.*, u.name AS staff_name, e.title AS event_title
             FROM tasks
             LEFT JOIN users u ON u.id = tasks.staff_id
             LEFT JOIN events e ON e.id = tasks.event_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY tasks.due ASC LIMIT 500";
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ tasks: results || [] }, 200, request);
}

async function createTask(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter a task and the staff member." }, 400, request);
  const title = vStr(body.title, { label: "the task", max: 200 });
  const staffId = vStr(body.staffId, { label: "the staff member", max: 80 });
  const due = vDate(body.due, { label: "the due date", required: false });
  const eventId = vStr(body.eventId, { label: "the event", required: false, max: 80 });
  for (const field of [title, staffId, due, eventId]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const staffError = await assertActiveStaff(env, staffId.value);
  if (staffError) return json({ error: staffError }, 400, request);
  const eventError = await assertExistingEvent(env, eventId.value || null);
  if (eventError) return json({ error: eventError }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO tasks (id, event_id, staff_id, title, due, status, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, 'open', ?, 0)`
    ).bind(id, eventId.value || null, staffId.value, title.value, due.value || null, isoNow()),
    auditStmt(env, user, "create", "tasks", id, title.value, request)
  ]);
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  return json({ task }, 201, request);
}

async function patchTask(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Task not found." }, 404, request);
  if (user.role === "staff" && existing.staff_id !== user.id) return deny(request);
  const body = await readJson(request) || {};
  let status = existing.status;
  if (body.status) status = body.status;
  else status = existing.status === "done" ? "open" : "done";
  if (status !== "open" && status !== "done") return json({ error: "Status must be open or done." }, 400, request);
  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET status = ? WHERE id = ?").bind(status, id),
    auditStmt(env, user, "update", "tasks", id, status, request, existing.is_sample)
  ]);
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  return json({ task }, 200, request);
}

async function deleteTask(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Task not found." }, 404, request);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id),
    auditStmt(env, user, "delete", "tasks", id, existing.title, request, existing.is_sample)
  ]);
  return json({ ok: true }, 200, request);
}

async function listAttendance(env, request, user) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const staffId = url.searchParams.get("staff") || "";
  const clauses = [];
  const params = [];
  if (user.role === "staff") {
    clauses.push("attendance.staff_id = ?");
    params.push(user.id);
  } else if (staffId) {
    clauses.push("attendance.staff_id = ?");
    params.push(staffId);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("attendance.date >= ?"); params.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("attendance.date <= ?"); params.push(to); }
  let sql = `SELECT attendance.*, u.name AS staff_name
             FROM attendance
             LEFT JOIN users u ON u.id = attendance.staff_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY attendance.date DESC, staff_name ASC LIMIT 500";
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  const rows = results || [];
  if (url.searchParams.get("format") === "csv" && user.role !== "staff") {
    const csv = toCsv(rows, [
      { key: "date", label: "Date" },
      { key: "staff_name", label: "Staff" },
      { key: "time_in", label: "Time in" },
      { key: "time_out", label: "Time out" }
    ]);
    return fileResponse(csv, "attendance.csv", "text/csv; charset=utf-8", request);
  }
  return json({ attendance: rows }, 200, request);
}

async function clock(env, request, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const today = todayISO();
  const time = nowTime();
  const open = await env.DB.prepare(
    "SELECT * FROM attendance WHERE staff_id = ? AND date = ? AND time_out IS NULL ORDER BY time_in DESC LIMIT 1"
  ).bind(user.id, today).first();
  const sample = sampleFromActor(user, open);
  if (open) {
    await env.DB.batch([
      env.DB.prepare("UPDATE attendance SET time_out = ? WHERE id = ?").bind(time, open.id),
      auditStmt(env, user, "clock_out", "attendance", open.id, `${today} ${time}`, request, sample)
    ]);
  } else {
    const punchId = randomId();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO attendance (id, staff_id, date, time_in, time_out, is_sample) VALUES (?, ?, ?, ?, NULL, ?)"
      ).bind(punchId, user.id, today, time, sample),
      auditStmt(env, user, "clock_in", "attendance", punchId, `${today} ${time}`, request, sample)
    ]);
  }
  const { results } = await env.DB.prepare(
    "SELECT attendance.*, u.name AS staff_name FROM attendance LEFT JOIN users u ON u.id = attendance.staff_id WHERE attendance.staff_id = ? ORDER BY date DESC"
  ).bind(user.id).all();
  return json({ attendance: results || [] }, 200, request);
}

async function patchAttendance(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM attendance WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Attendance row not found." }, 404, request);
  const fields = {};
  if (body.time_in !== undefined) {
    const timeIn = vTime(body.time_in, "time in");
    if (timeIn.error) return json({ error: timeIn.error }, 400, request);
    fields.time_in = timeIn.value;
  }
  if (body.time_out !== undefined) {
    if (body.time_out === "" || body.time_out === null) fields.time_out = null;
    else {
      const timeOut = vTime(body.time_out, "time out");
      if (timeOut.error) return json({ error: timeOut.error }, 400, request);
      fields.time_out = timeOut.value;
    }
  }
  if (body.date !== undefined) {
    const date = vDate(body.date, { label: "the date" });
    if (date.error) return json({ error: date.error }, 400, request);
    fields.date = date.value;
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ attendance: existing }, 200, request);
  const note = vStr(body.note, { label: "a reason", min: 3, max: 300 });
  if (note.error) return json({ error: note.error }, 400, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE attendance SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "correct", "attendance", id, JSON.stringify({ before: { time_in: existing.time_in, time_out: existing.time_out, date: existing.date }, after: fields, note: note.value }), request, existing.is_sample)
  ]);
  const row = await env.DB.prepare(
    "SELECT attendance.*, u.name AS staff_name FROM attendance LEFT JOIN users u ON u.id = attendance.staff_id WHERE attendance.id = ?"
  ).bind(id).first();
  return json({ attendance: row }, 200, request);
}

async function listAnnouncements(env, request) {
  const { results } = await env.DB.prepare("SELECT * FROM announcements ORDER BY date DESC LIMIT 200").all();
  return json({ announcements: results || [] }, 200, request);
}

async function createAnnouncement(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter a title and message." }, 400, request);
  const title = vStr(body.title, { label: "a title", max: 160 });
  const bodyText = vStr(body.body, { label: "a message", max: 2000 });
  const date = vDate(body.date || todayISO(), { label: "the date" });
  for (const field of [title, bodyText, date]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO announcements (id, date, title, body, created_at, created_by, is_sample) VALUES (?, ?, ?, ?, ?, ?, 0)"
    ).bind(id, date.value, title.value, bodyText.value, isoNow(), user.id),
    auditStmt(env, user, "create", "announcements", id, title.value, request)
  ]);
  const item = await env.DB.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
  return json({ announcement: item }, 201, request);
}

async function listFinances(env, request) {
  const demoMode = await getDemoMode(env, request);
  const { results } = await env.DB.prepare(
    `SELECT event_id AS id, date, client, title, status, is_sample,
            contract_total, collected, balance
     FROM v_event_balance WHERE status != 'Cancelled' ORDER BY date ASC`
  ).all();
  const events = results || [];
  const real = events.filter((event) => !event.is_sample);
  const sample = events.filter((event) => event.is_sample);
  const visible = demoMode ? events : real;
  const sum = (rows) => ({
    fees: rows.reduce((total, event) => total + (event.contract_total || 0), 0),
    collected: rows.reduce((total, event) => total + (event.collected || 0), 0),
    deposits: rows.reduce((total, event) => total + (event.collected || 0), 0),
    balance: rows.reduce((total, event) => total + (event.balance || 0), 0)
  });
  return json({
    events: visible,
    totals: sum(visible),
    sampleTotals: sum(sample),
    includesSample: demoMode && sample.length > 0,
    demoMode,
    hasSample: sample.length > 0
  }, 200, request);
}

async function listUsers(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, password_set_at, is_sample, is_active FROM users ORDER BY name ASC"
  ).all();
  return json({ users: results || [] }, 200, request);
}

async function createUser(request, env, actor) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const name = vStr(body.name, { label: "the name", max: 80 });
  const email = vEmail(body.email);
  const title = vStr(body.title, { label: "the title", required: false, max: 80 });
  const role = vOneOf(String(body.role || "staff"), ["owner", "admin", "staff"], "role");
  const password = String(body.password || "");
  for (const field of [name, email, title, role]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const pwdError = validPassword(password);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.value).first();
  if (exists) return json({ error: "That email already has an account." }, 409, request);
  const salt = newSalt();
  const hash = await hashPassword(password, salt);
  const id = randomId();
  const now = isoNow();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, role, title, password_hash, password_salt, password_set_at, must_change_password, is_active, is_sample, created_at, password_algo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?)`
    ).bind(id, email.value, name.value, role.value, title.value, hash, salt, now, now, PASSWORD_ALGO),
    auditStmt(env, actor, "create", "users", id, `${email.value} ${role.value}`, request)
  ]);
  const user = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, is_sample, is_active FROM users WHERE id = ?"
  ).bind(id).first();
  return json({ user }, 201, request);
}

async function patchUser(id, request, env, actor) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "User not found." }, 404, request);
  if (existing.role === "owner" && body.role && body.role !== "owner" && existing.id === actor.id) {
    return json({ error: "You cannot remove your own owner role." }, 400, request);
  }
  const updates = [];
  const values = [];
  let revoke = false;
  if (body.name) {
    const name = vStr(body.name, { label: "the name", max: 80 });
    if (name.error) return json({ error: name.error }, 400, request);
    updates.push("name = ?");
    values.push(name.value);
  }
  if (body.title !== undefined) {
    const title = vStr(body.title, { label: "the title", required: false, max: 80 });
    if (title.error) return json({ error: title.error }, 400, request);
    updates.push("title = ?");
    values.push(title.value);
  }
  let nextRole = existing.role;
  let nextActive = existing.is_active === 0 ? 0 : 1;
  if (body.role) {
    const role = vOneOf(body.role, ["owner", "admin", "staff"], "role");
    if (role.error) return json({ error: role.error }, 400, request);
    updates.push("role = ?");
    values.push(role.value);
    nextRole = role.value;
    if (role.value !== existing.role) revoke = true;
  }
  if (body.is_active !== undefined) {
    const active = body.is_active ? 1 : 0;
    updates.push("is_active = ?");
    values.push(active);
    nextActive = active;
    if (active === 0) revoke = true;
  }
  if (existing.role === "owner" && (nextRole !== "owner" || nextActive === 0)) {
    const others = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND IFNULL(is_active, 1) = 1 AND IFNULL(is_sample, 0) = 0 AND id != ?"
    ).bind(id).first();
    if (!others || Number(others.n) < 1) {
      return json({ error: "There must be at least one active owner account." }, 400, request);
    }
  }
  if (body.password) {
    const pwdError = validPassword(String(body.password));
    if (pwdError) return json({ error: pwdError }, 400, request);
    const salt = newSalt();
    const hash = await hashPassword(String(body.password), salt);
    updates.push("password_hash = ?", "password_salt = ?", "password_set_at = ?", "must_change_password = 1", "password_algo = ?");
    values.push(hash, salt, isoNow(), PASSWORD_ALGO);
    revoke = true;
  }
  if (!updates.length) return json({ user: publicUser(existing) }, 200, request);
  values.push(id);
  const statements = [
    env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values),
    auditStmt(env, actor, "update", "users", id, JSON.stringify({ ...body, password: body.password ? "[set]" : undefined }), request, existing.is_sample)
  ];
  if (revoke) statements.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
  await env.DB.batch(statements);
  const user = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, is_sample, is_active FROM users WHERE id = ?"
  ).bind(id).first();
  return json({ user }, 200, request);
}

async function revokeUserSessions(id, request, env, actor) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  await revokeSessions(env, id);
  await audit(env, actor, "logout_all", "sessions", id, "Owner signed this user out everywhere", request);
  return json({ ok: true }, 200, request);
}


async function cleanupSmoke(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (!user || !user.is_sample) return json({ error: "Only a sample owner can clean up smoke records." }, 403, request);
  const body = await readJson(request);
  const runId = String((body && body.run_id) || "").trim();
  if (!runId || runId.length < 8 || !/^SMK-[A-Za-z0-9-]+$/.test(runId)) {
    return json({ error: "Please send the smoke run id." }, 400, request);
  }
  if (!body || !Array.isArray(body.records)) return json({ error: "Please send the smoke records to remove." }, 400, request);
  const tables = {
    clients: { table: "clients", idCol: "id" },
    leads: { table: "leads", idCol: "id" },
    leave_requests: { table: "leave_requests", idCol: "id" },
    areas: { table: "areas", idCol: "id" },
    hk_templates: { table: "hk_templates", idCol: "id" },
    hk_template_items: { table: "hk_template_items", idCol: "template_id" },
    inventory_items: { table: "inventory_items", idCol: "id" },
    inventory_moves: { table: "inventory_moves", idCol: "item_id" },
    expenses: { table: "expenses", idCol: "id" },
    quotes: { table: "quotes", idCol: "id" },
    quote_lines: { table: "quote_lines", idCol: "quote_id" },
    contracts: { table: "contracts", idCol: "id" },
    events: { table: "events", idCol: "id" },
    payments: { table: "payments", idCol: "id" },
    purchase_orders: { table: "purchase_orders", idCol: "id" },
    po_lines: { table: "po_lines", idCol: "po_id" },
    requests: { table: "requests", idCol: "id" },
    attendance: { table: "attendance", idCol: "id" }
  };
  const deleteOrder = ["quote_lines", "hk_template_items", "inventory_moves", "po_lines", "payments", "contracts", "events", "quotes", "purchase_orders", "expenses", "inventory_items", "leave_requests", "leads", "clients", "areas", "hk_templates", "requests", "attendance"];
  const records = body.records.slice(0, 80).slice().sort((a, b) => {
    const ai = deleteOrder.indexOf(a && a.table);
    const bi = deleteOrder.indexOf(b && b.table);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  let removed = 0;
  const audits = [];
  for (const rec of records) {
    const spec = tables[rec && rec.table];
    const id = rec && rec.id;
    if (!spec || !id) continue;
    const rows = (await env.DB.prepare(`SELECT * FROM ${spec.table} WHERE ${spec.idCol} = ? AND IFNULL(is_sample,0)=1`).bind(id).all()).results || [];
    let tagged = rows.filter((row) => JSON.stringify(row).includes(runId));
    if (!tagged.length) {
      let parentSql = null;
      if (spec.table === "inventory_moves") parentSql = "SELECT * FROM inventory_items WHERE id = ? AND IFNULL(is_sample,0)=1";
      else if (spec.table === "hk_template_items") parentSql = "SELECT * FROM hk_templates WHERE id = ? AND IFNULL(is_sample,0)=1";
      else if (spec.table === "quote_lines") parentSql = "SELECT * FROM quotes WHERE id = ? AND IFNULL(is_sample,0)=1";
      else if (spec.table === "po_lines") parentSql = "SELECT * FROM purchase_orders WHERE id = ? AND IFNULL(is_sample,0)=1";
      if (parentSql) {
        const parent = await env.DB.prepare(parentSql).bind(id).first();
        if (parent && JSON.stringify(parent).includes(runId)) tagged = rows.length ? rows : [parent];
      }
    }
    if (!tagged.length && spec.table === "attendance") {
      const punch = rows[0] || await env.DB.prepare("SELECT * FROM attendance WHERE id = ? AND IFNULL(is_sample,0)=1").bind(id).first();
      const started = String((body && body.run_started_at) || "").trim();
      if (punch && started && `${punch.date || ""}T${punch.time_in || "00:00"}` >= started.slice(0, 16)) {
        tagged = [punch];
      }
    }
    if (!tagged.length) continue;
    const result = await env.DB.prepare(`DELETE FROM ${spec.table} WHERE ${spec.idCol} = ? AND IFNULL(is_sample,0)=1`).bind(id).run();
    const changes = (result && result.meta && result.meta.changes) || 0;
    if (changes) {
      removed += changes;
      audits.push(auditStmt(env, user, "smoke-cleanup", spec.table, id, `run ${runId}`, request, 1));
    }
  }
  if (audits.length) await env.DB.batch(audits);
  return json({ ok: true, removed, run_id: runId }, 200, request);
}

async function sampleStatus(env, request) {
  const tables = ["users", "events", "requests", "shifts", "tasks", "announcements", "attendance",
    "clients", "leads", "quotes", "contracts", "payments", "packages",
    "checklists", "issues", "inventory_items", "expenses", "petty_cash",
    "payroll_periods", "cash_advances", "leave_requests"];
  const counts = {};
  let hasSample = false;
  for (const table of tables) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE IFNULL(is_sample, 0) = 1`).first();
    counts[table] = Number(row && row.n) || 0;
    if (counts[table]) hasSample = true;
  }
  const demoMode = hasSample ? await getDemoMode(env, request) : false;
  return json({ hasSample, demoMode, counts }, 200, request);
}

// Hardcoded table/column pairs only. Real rows that point at sample rows block removal.
const SAMPLE_FK_REFS = [
  ["events", "created_by", "users"],
  ["events", "coordinator_id", "users"],
  ["events", "from_request", "requests"],
  ["events", "client_id", "clients"],
  ["events", "package_id", "packages"],
  ["events", "quote_id", "quotes"],
  ["requests", "decided_by", "users"],
  ["shifts", "staff_id", "users"],
  ["shifts", "event_id", "events"],
  ["tasks", "staff_id", "users"],
  ["tasks", "event_id", "events"],
  ["attendance", "staff_id", "users"],
  ["attendance", "shift_id", "shifts"],
  ["announcements", "created_by", "users"],
  ["leads", "assigned_to", "users"],
  ["leads", "client_id", "clients"],
  ["leads", "request_id", "requests"],
  ["quotes", "created_by", "users"],
  ["quotes", "lead_id", "leads"],
  ["quotes", "request_id", "requests"],
  ["quotes", "event_id", "events"],
  ["quotes", "client_id", "clients"],
  ["quote_lines", "quote_id", "quotes"],
  ["contracts", "created_by", "users"],
  ["contracts", "quote_id", "quotes"],
  ["contracts", "event_id", "events"],
  ["contracts", "client_id", "clients"],
  ["payments", "created_by", "users"],
  ["payments", "event_id", "events"],
  ["payments", "quote_id", "quotes"],
  ["payments", "contract_id", "contracts"],
  ["event_details", "event_id", "events"],
  ["event_details", "coordinator_id", "users"],
  ["event_item_allocations", "event_id", "events"],
  ["event_item_allocations", "item_id", "inventory_items"],
  ["checklists", "event_id", "events"],
  ["checklists", "assigned_to", "users"],
  ["checklists", "template_id", "hk_templates"],
  ["checklist_items", "checklist_id", "checklists"],
  ["issues", "assigned_to", "users"],
  ["inventory_moves", "created_by", "users"],
  ["inventory_moves", "item_id", "inventory_items"],
  ["purchase_orders", "supplier_id", "suppliers"],
  ["po_lines", "po_id", "purchase_orders"],
  ["expenses", "created_by", "users"],
  ["expenses", "event_id", "events"],
  ["petty_cash", "created_by", "users"],
  ["cash_advances", "user_id", "users"],
  ["leave_requests", "user_id", "users"],
  ["payroll_entries", "user_id", "users"],
  ["payroll_lines", "entry_id", "payroll_entries"],
  
  ["payment_schedule", "event_id", "events"],
  ["payment_schedule", "contract_id", "contracts"]
];

async function findSampleBlockers(env) {
  const found = [];
  for (const [table, col, target] of SAMPLE_FK_REFS) {
    const sql = `SELECT '${table}' AS src, id FROM ${table} WHERE IFNULL(is_sample, 0) = 0 AND ${col} IS NOT NULL AND ${col} IN (SELECT id FROM ${target} WHERE IFNULL(is_sample, 0) = 1) LIMIT 20`;
    const { results } = await env.DB.prepare(sql).all();
    if (results && results.length) found.push(...results);
  }
  const profiles = await env.DB.prepare(
    "SELECT 'staff_profiles' AS src, user_id AS id FROM staff_profiles WHERE IFNULL(is_sample, 0) = 0 AND user_id IN (SELECT id FROM users WHERE IFNULL(is_sample, 0) = 1) LIMIT 20"
  ).all();
  if (profiles.results && profiles.results.length) found.push(...profiles.results);
  return found;
}

async function removeSample(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body || body.confirm !== "REMOVE") {
    return json({ error: "Type REMOVE to confirm that you want to delete all sample records." }, 400, request);
  }
  const found = await findSampleBlockers(env);
  if (found.length) {
    return json({
      error: "Some real records still refer to sample data. Please reassign or edit those first.",
      code: "sample_in_use",
      references: found.slice(0, 20)
    }, 409, request);
  }
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE IFNULL(is_sample, 0) = 1)"),
    env.DB.prepare("DELETE FROM quote_lines WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM po_lines WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM hk_template_items WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM checklist_items WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM payment_schedule WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM event_item_allocations WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM inventory_moves WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM payroll_lines WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM payments WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM expenses WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM petty_cash WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM cash_advances WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM leave_requests WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM payroll_entries WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM payroll_periods WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM contracts WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM quotes WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM leads WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM packages WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM event_details WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM checklists WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM issues WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM hk_templates WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM inventory_items WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM purchase_orders WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM suppliers WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM areas WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM venues WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM clients WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM accounts WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM stock_locations WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM staff_profiles WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM attendance WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM tasks WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM shifts WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM announcements WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM events WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM requests WHERE IFNULL(is_sample, 0) = 1"),
    auditStmt(env, user, "remove_sample", "sample", null, "Owner removed sample data", request),
    env.DB.prepare("DELETE FROM users WHERE IFNULL(is_sample, 0) = 1")
  ]);
  const failed = results.some((row) => row && row.success === false);
  if (failed) return json({ error: "Could not remove all sample data. Please try again." }, 500, request);
  await setDemoMode(env, false, user);
  return sampleStatus(env, request);
}

async function listAudit(env, request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
  const { results } = await env.DB.prepare(
    "SELECT * FROM audit_log ORDER BY at DESC LIMIT ?"
  ).bind(limit).all();
  return json({ entries: results || [] }, 200, request);
}


async function exportIncludesSample(env, request) {
  return getDemoMode(env, request);
}

function tagExportRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    is_sample: row.is_sample ? "SAMPLE" : ""
  }));
}

async function exportReport(url, env, request, user) {
  const table = url.searchParams.get("table") || "";
  const format = url.searchParams.get("format") || "csv";
  const allow = {
    events: user.role === "owner" || user.role === "admin",
    requests: user.role === "owner" || user.role === "admin",
    attendance: user.role === "owner" || user.role === "admin",
    finances: user.role === "owner",
    leads: user.role === "owner" || user.role === "admin",
    quotes: user.role === "owner",
    payments: user.role === "owner",
    expenses: user.role === "owner",
    inventory: user.role === "owner" || user.role === "admin",
    housekeeping: user.role === "owner" || user.role === "admin"
  };
  if (!allow[table]) return json({ error: "Please pick a report you can download." }, 400, request);
  const includeSample = await exportIncludesSample(env, request);
  const sampleFilter = includeSample ? "" : " AND IFNULL(is_sample,0)=0";
  const attSampleFilter = includeSample ? "" : " AND IFNULL(attendance.is_sample,0)=0";
  let rows = [];
  let columns = [];
  if (table === "events") {
    const eventSample = sampleFilter.replace("is_sample", "e.is_sample");
    const sql = user.role === "owner"
      ? `SELECT e.date, e.client, e.title, e.type, e.package, e.pax, e.venue, e.status,
                IFNULL(b.contract_total, 0) AS contract_total, IFNULL(b.collected, 0) AS paid, IFNULL(b.balance, 0) AS balance, e.is_sample
         FROM events e
         LEFT JOIN v_event_balance b ON b.event_id = e.id
         WHERE 1=1${eventSample} ORDER BY e.date`
      : `SELECT e.date, e.client, e.title, e.type, e.package, e.pax, e.venue, e.status, e.is_sample FROM events e WHERE 1=1${eventSample} ORDER BY e.date`;
    rows = (await env.DB.prepare(sql).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "client", label: "Client" }, { key: "title", label: "Title" },
      { key: "type", label: "Type" }, { key: "package", label: "Package" }, { key: "pax", label: "Pax" },
      { key: "venue", label: "Venue" }, { key: "status", label: "Status" }
    ];
    if (user.role === "owner") {
      columns.push({ key: "contract_total", label: "Contract total" }, { key: "paid", label: "Paid" }, { key: "balance", label: "Balance" });
    }
  } else if (table === "requests") {
    rows = (await env.DB.prepare(
      `SELECT date, name, contact, type, package, pax, venue, status, created_at, decline_reason, is_sample FROM requests WHERE 1=1${sampleFilter} ORDER BY date`
    ).all()).results || [];
    columns = [
      { key: "date", label: "Event date" }, { key: "name", label: "Name" }, { key: "contact", label: "Contact" },
      { key: "type", label: "Type" }, { key: "package", label: "Package" }, { key: "pax", label: "Pax" },
      { key: "venue", label: "Venue" }, { key: "status", label: "Status" }, { key: "created_at", label: "Submitted" },
      { key: "decline_reason", label: "Decline reason" }
    ];
  } else if (table === "attendance") {
    rows = (await env.DB.prepare(
      `SELECT attendance.date, u.name AS staff_name, attendance.time_in, attendance.time_out, attendance.is_sample
       FROM attendance LEFT JOIN users u ON u.id = attendance.staff_id
       WHERE 1=1${attSampleFilter}
       ORDER BY attendance.date DESC`
    ).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "staff_name", label: "Staff" },
      { key: "time_in", label: "Time in" }, { key: "time_out", label: "Time out" }
    ];
  } else if (table === "finances") {
    const finWhere = includeSample ? "status != 'Cancelled'" : "status != 'Cancelled' AND IFNULL(is_sample,0)=0";
    rows = (await env.DB.prepare(
      `SELECT date, client, title, contract_total, collected, balance, status, is_sample FROM v_event_balance WHERE ${finWhere} ORDER BY date`
    ).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "client", label: "Client" }, { key: "title", label: "Title" },
      { key: "contract_total", label: "Contract total" }, { key: "collected", label: "Collected" },
      { key: "balance", label: "Balance" }, { key: "status", label: "Status" }
    ];
  } else if (table === "leads") {
    rows = (await env.DB.prepare(`SELECT name, contact, source, status, event_date, venue, pax, created_at, is_sample FROM leads WHERE 1=1${sampleFilter} ORDER BY created_at`).all()).results || [];
    columns = [
      { key: "name", label: "Name" }, { key: "contact", label: "Contact" }, { key: "source", label: "Source" },
      { key: "status", label: "Stage" }, { key: "event_date", label: "Event date" }, { key: "venue", label: "Venue" },
      { key: "pax", label: "Pax" }, { key: "created_at", label: "Created" }
    ];
  } else if (table === "quotes") {
    rows = (await env.DB.prepare(`SELECT number, client_name, event_date, venue, total, status, valid_until, is_sample FROM quotes WHERE 1=1${sampleFilter} ORDER BY created_at`).all()).results || [];
    columns = [
      { key: "number", label: "Number" }, { key: "client_name", label: "Client" }, { key: "event_date", label: "Event date" },
      { key: "venue", label: "Venue" }, { key: "total", label: "Total" }, { key: "status", label: "Status" },
      { key: "valid_until", label: "Valid until" }
    ];
  } else if (table === "payments") {
    rows = (await env.DB.prepare(`SELECT receipt_no, client_name, kind, amount, method, received_at, voided_at, is_sample FROM payments WHERE 1=1${sampleFilter} ORDER BY received_at`).all()).results || [];
    columns = [
      { key: "receipt_no", label: "OR" }, { key: "client_name", label: "Client" }, { key: "kind", label: "Kind" },
      { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "received_at", label: "Received" },
      { key: "voided_at", label: "Voided" }
    ];
  } else if (table === "expenses") {
    rows = (await env.DB.prepare(`SELECT date, category, payee, amount, method, receipt_no, is_sample FROM expenses WHERE voided_at IS NULL${sampleFilter} ORDER BY date`).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "category", label: "Category" }, { key: "payee", label: "Payee" },
      { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "receipt_no", label: "Receipt" }
    ];
  } else if (table === "inventory") {
    rows = (await env.DB.prepare(`SELECT name, sku, category, unit, qty_on_hand, reorder_level, is_sample FROM inventory_items WHERE 1=1${sampleFilter} ORDER BY category, name`).all()).results || [];
    columns = [
      { key: "name", label: "Item" }, { key: "sku", label: "SKU" }, { key: "category", label: "Category" },
      { key: "unit", label: "Unit" }, { key: "qty_on_hand", label: "On hand" }, { key: "reorder_level", label: "Reorder at" }
    ];
  } else if (table === "housekeeping") {
    rows = (await env.DB.prepare(`SELECT title, kind, status, due, is_sample FROM checklists WHERE 1=1${sampleFilter} ORDER BY due`).all()).results || [];
    columns = [
      { key: "title", label: "Job" }, { key: "kind", label: "Kind" }, { key: "status", label: "Status" }, { key: "due", label: "Due" }
    ];
  }
  if (includeSample) {
    rows = tagExportRows(rows);
    columns = columns.concat({ key: "is_sample", label: "Sample" });
  }
  await audit(env, user, "export", table, null, `${format} download`, request, sampleFromActor(user));
  if (format === "xlsx") {
    return fileResponse(toXlsx(rows, columns, table), `${table}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", request);
  }
  return fileResponse(toCsv(rows, columns), `${table}.csv`, "text/csv; charset=utf-8", request);
}
