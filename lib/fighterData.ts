/**
 * Shared fighter data module
 *
 * Canonical source of fighter definitions, used by both Durable Objects
 * and the client-side game code. Keeps fighter validation in one place
 * so that WebSocket endpoints can accept a simple fighterId instead of
 * trusting arbitrary JSON from the client.
 */
import type { Fighter } from './types';

export const FIGHTERS: Fighter[] = [
  // ---- GROWTH TYPE ----
  {
    id: 'elena-verna',
    name: 'Elena Verna',
    title: 'Growth Advisor',
    type: 'Growth',
    stats: { hp: 120, atk: 16, def: 8, spd: 14 },
    avatar: '/assets/avatars/Elena-Verna_pixel_art.webp',
    moves: [
      { name: 'PLG Surge', type: 'Growth', power: 28, description: 'Unleashes product-led growth at scale' },
      { name: 'Viral Loop', type: 'Growth', power: 24, description: 'Creates a self-reinforcing growth cycle' },
      { name: 'Retention Shield', type: 'Growth', power: 18, description: 'Locks in users with sticky features' },
      { name: 'Monetization Wave', type: 'Growth', power: 32, description: 'Converts free users into paying customers' },
    ],
    trivia: [
      { question: 'What is the core difference between product-led sales and traditional sales models?', options: ['Marketing creates pipeline', 'Product acquires and activates customers', 'Sales only sells to new users', 'Marketing handles account management'], answer: 'Product acquires and activates customers' },
      { question: 'In a product-led sales setup, who is primarily accountable for the sales pipeline?', options: ['Marketing team', 'Sales team', 'Product team', 'Customer support'], answer: 'Product team' },
      { question: 'Which best describes a risk of blending product-led growth and marketing-led sales without clear boundaries?', options: ['Enhanced customer experience', 'Disorganized collaboration', 'Increased revenue', 'Faster onboarding'], answer: 'Disorganized collaboration' },
      { question: 'Why is self-serve monetization capped around $10,000 in many SaaS products?', options: ['Limited credit card limits', 'Product can\'t handle more', 'Market demand drops after', 'Legal restrictions apply'], answer: 'Limited credit card limits' },
    ],
},
  {
    id: 'nir-eyal',
    name: 'Nir Eyal',
    title: 'Behavioral Designer',
    type: 'Growth',
    stats: { hp: 105, atk: 15, def: 10, spd: 12 },
    avatar: '/assets/avatars/Nir-Eyal_pixel_art.webp',
    moves: [
      { name: 'Hook Model', type: 'Growth', power: 28, description: 'Trigger, Action, Reward, Investment' },
      { name: 'Habit Loop', type: 'Growth', power: 24, description: 'Builds an unbreakable user habit' },
      { name: 'Variable Reward', type: 'Growth', power: 22, description: 'Unpredictable rewards keep them coming back' },
      { name: 'Indistractable', type: 'Growth', power: 18, description: 'Focused defense blocks all distractions' },
    ],
    trivia: [
      { question: 'What is the opposite of distraction according to Nir Eyal?', options: ['Focus', 'Attention', 'Traction', 'Concentration'], answer: 'Traction' },
      { question: 'According to Nir Eyal, what primarily causes distraction?', options: ['Technology pings', 'Feeling and emotion', 'External interruptions', 'Poor time management'], answer: 'Feeling and emotion' },
      { question: 'What is a recommended approach to managing internal triggers that lead to distraction?', options: ['Ignore feelings', 'Identify and understand the emotion', 'Suppress emotions immediately', 'Distract with more tech'], answer: 'Identify and understand the emotion' },
      { question: 'Which best describes "traction" as used by Nir Eyal?', options: ['External notifications', 'Actions aligned with your intentions', 'Random distractions', 'Multitasking during work'], answer: 'Actions aligned with your intentions' },
    ],
},

  // ---- PRODUCT TYPE ----
  {
    id: 'shreyas-doshi',
    name: 'Shreyas Doshi',
    title: 'Product Strategist',
    type: 'Product',
    stats: { hp: 130, atk: 13, def: 13, spd: 10 },
    avatar: '/assets/avatars/Shreyas-Doshi_pixel_art.webp',
    moves: [
      { name: 'LNO Framework', type: 'Product', power: 26, description: 'Prioritizes Leverage, Neutral, Overhead tasks' },
      { name: 'Pre-mortem', type: 'Product', power: 22, description: 'Anticipates failures before they happen' },
      { name: 'Opinionated PM', type: 'Product', power: 28, description: 'Takes a strong stance and ships it' },
      { name: 'High Agency', type: 'Product', power: 32, description: 'Finds a way when there is no way' },
    ],
    trivia: [
      { question: 'What is a key factor that leads to feeling overwhelmed as a product leader?', options: ['Lack of technical skills', 'Growing scope of responsibilities', 'Poor team communication', 'Inadequate tools'], answer: 'Growing scope of responsibilities' },
      { question: 'Which approach is suggested to manage constant busyness in a product role?', options: ['Implement more productivity tools', 'Prioritize tasks better', 'Limit scope or focus on core work', 'Reduce meetings'], answer: 'Limit scope or focus on core work' },
      { question: 'According to Shreyas, what is a long-term solution to avoid burnout despite productivity tricks?', options: ['Work longer hours', 'Automate everything', 'Cap or reduce scope', 'Hire more people'], answer: 'Cap or reduce scope' },
      { question: 'What is a core question product leaders should ask to improve their effectiveness?', options: ['Am I using the latest tech?', 'Are all stakeholders aligned?', 'Is my scope manageable?', 'Have I set ambitious goals?'], answer: 'Is my scope manageable?' },
    ],
},
  {
    id: 'marty-cagan',
    name: 'Marty Cagan',
    title: 'Product Discovery Pioneer',
    type: 'Product',
    stats: { hp: 135, atk: 12, def: 14, spd: 9 },
    avatar: '/assets/avatars/Marty-Cagan_pixel_art.webp',
    moves: [
      { name: 'Empowered Teams', type: 'Product', power: 24, description: 'Unleashes autonomous product teams' },
      { name: 'Discovery Sprint', type: 'Product', power: 22, description: 'Validates ideas before building them' },
      { name: 'Missionary Team', type: 'Product', power: 28, description: 'Purpose-driven team attacks with passion' },
      { name: 'Inspired', type: 'Product', power: 30, description: 'Creates products people truly love' },
    ],
    trivia: [
      { question: 'What is a sign you are working on a feature team rather than an empowered product team?', options: ['Focused on delivering outcomes', 'Centered on user experiences', 'Primarily executing short-term features', 'Collaborating with cross-functional teams'], answer: 'Primarily executing short-term features' },
      { question: 'Which approach best helps a product team shift towards being more empowered?', options: ['Clear strategic goals and autonomy', 'More detailed project plans', 'Frequent status reporting', 'Increasing stakeholder control'], answer: 'Clear strategic goals and autonomy' },
      { question: 'What is a common mistake made by companies hiring product managers during the pandemic?', options: ['Hiring too many software engineers', 'Overhiring roles like product owners and analysts', 'Focusing only on technical skills', 'Reducing product management headcount'], answer: 'Overhiring roles like product owners and analysts' },
      { question: 'How can product managers avoid becoming "product management theater"?', options: ['Focus on delivering outcomes over output', 'Increase the number of meetings', 'Prioritize feature delivery speed', 'Reduce customer involvement'], answer: 'Focus on delivering outcomes over output' },
    ],
},
  {
    id: 'teresa-torres',
    name: 'Teresa Torres',
    title: 'Discovery Coach',
    type: 'Product',
    stats: { hp: 115, atk: 13, def: 11, spd: 12 },
    avatar: '/assets/avatars/Teresa-Torres_pixel_art.webp',
    moves: [
      { name: 'Opportunity Tree', type: 'Product', power: 24, description: 'Maps the entire solution space' },
      { name: 'Assumption Test', type: 'Product', power: 20, description: 'Validates risky assumptions fast' },
      { name: 'Interview Snap', type: 'Product', power: 22, description: 'Extracts deep insights from users' },
      { name: 'Continuous Discovery', type: 'Product', power: 28, description: 'Never stops learning from customers' },
    ],
    trivia: [
      { question: 'What is the primary purpose of the opportunity solution tree framework?', options: ['Prioritize feature development', 'Visualize team goals', 'Manage project deadlines', 'Structure problem and solution space'], answer: 'Structure problem and solution space' },
      { question: 'Which aspect of product management does the opportunity space emphasize?', options: ['Executing solutions quickly', 'Understanding customer needs', 'Optimizing feature releases', 'Managing engineering tasks'], answer: 'Understanding customer needs' },
      { question: 'What is a common mistake teams make when defining opportunities?', options: ['Writing them as solutions', 'Ignoring customer feedback', 'Focusing only on competitors', 'Overanalyzing data'], answer: 'Writing them as solutions' },
      { question: 'How can teams manage the discomfort of staying in the opportunity (problem) space?', options: ['Rely on intuition', 'Strictly follow leadership', 'Practice framing problems well', 'Skip directly to solutions'], answer: 'Practice framing problems well' },
    ],
},

  // ---- ENGINEERING TYPE ----
  {
    id: 'brian-chesky',
    name: 'Brian Chesky',
    title: 'Airbnb CEO',
    type: 'Engineering',
    stats: { hp: 140, atk: 14, def: 13, spd: 9 },
    avatar: '/assets/avatars/Brian-Chesky_pixel_art.webp',
    moves: [
      { name: 'Founder Mode', type: 'Engineering', power: 32, description: 'Gets into every detail personally' },
      { name: 'Design Review', type: 'Design', power: 24, description: 'Pixel-perfect standards for everything' },
      { name: 'Platform Scale', type: 'Engineering', power: 26, description: 'Scales from 0 to millions of hosts' },
      { name: '11-Star Experience', type: 'Engineering', power: 20, description: 'Goes absurdly beyond expectations' },
    ],
    trivia: [
      { question: 'What is a key difference between micromanagement and being in the details?', options: ['Telling people exactly what to do', 'Understanding the broader vision', 'Monitoring team performance', 'Being involved in strategic planning'], answer: 'Understanding the broader vision' },
      { question: 'Why does Brian Chesky emphasize knowing the details in a product-driven company?', options: ['To micromanage team members', 'To ensure the product is market-aligned', 'To control engineering decisions', 'To avoid broad strategic planning'], answer: 'To ensure the product is market-aligned' },
      { question: 'In Airbnb\'s new structure, what is the primary role of senior product marketers?', options: ['Control design decisions', 'Manage engineering teams', 'Talk effectively about the product', 'Set company strategy'], answer: 'Talk effectively about the product' },
      { question: 'What approach does Airbnb now favor for growth over traditional channels?', options: ['Paid advertising', 'Viral marketing', 'Building the best product', 'Expanding sales teams'], answer: 'Building the best product' },
    ],
},
  {
    id: 'dylan-field',
    name: 'Dylan Field',
    title: 'Figma CEO',
    type: 'Engineering',
    stats: { hp: 115, atk: 15, def: 10, spd: 13 },
    avatar: '/assets/avatars/Dylan-Field_pixel_art.webp',
    moves: [
      { name: 'Multiplayer Edit', type: 'Engineering', power: 26, description: 'Real-time collaboration at scale' },
      { name: 'WebGL Render', type: 'Engineering', power: 28, description: 'Renders complex designs in the browser' },
      { name: 'Auto Layout', type: 'Design', power: 22, description: 'Everything snaps into perfect alignment' },
      { name: 'Dev Mode', type: 'Engineering', power: 24, description: 'Translates design to code seamlessly' },
    ],
    trivia: [
      { question: 'What is a recommended approach to maintain team focus during uncertain times?', options: ['Increase work hours', 'Frequent transparent communication', 'Reduce project scope', 'Limit stakeholder updates'], answer: 'Frequent transparent communication' },
      { question: 'Why should product teams prioritize getting to market faster?', options: ['To beat competitors', 'To validate ideas quickly', 'To increase sales immediately', 'To avoid development costs'], answer: 'To validate ideas quickly' },
      { question: 'How can making a product more engaging by adding "fun" differentiate it?', options: ['It reduces development time', 'It creates a distinct emotional connection', 'It decreases user support costs', 'It simplifies design'], answer: 'It creates a distinct emotional connection' },
      { question: 'Why should organizations continuously adapt their processes as models improve?', options: ['To lower operational costs', 'To leverage increased productivity', 'To reduce headcount', 'To eliminate innovation'], answer: 'To leverage increased productivity' },
    ],
},
  {
    id: 'eric-ries',
    name: 'Eric Ries',
    title: 'Lean Startup Author',
    type: 'Engineering',
    stats: { hp: 125, atk: 13, def: 12, spd: 11 },
    avatar: '/assets/avatars/Eric-Ries_pixel_art.webp',
    moves: [
      { name: 'Build-Measure-Learn', type: 'Engineering', power: 24, description: 'Iterates rapidly through the lean loop' },
      { name: 'Pivot Strike', type: 'Engineering', power: 30, description: 'Changes direction with devastating force' },
      { name: 'MVP Launch', type: 'Product', power: 22, description: 'Ships the minimum viable attack' },
      { name: 'Validated Learning', type: 'Data', power: 20, description: 'Every experiment teaches something' },
    ],
    trivia: [
      { question: 'What is a recommended approach for minimizing risk during product development?', options: ['Build a fully-featured product first', 'Launch a simple MVP and iterate', 'Wait until perfect before releasing', 'Develop in secret until ready'], answer: 'Launch a simple MVP and iterate' },
      { question: 'Which term describes testing different variations to understand what works best?', options: ['Customer development', 'Pivoting', 'A/B testing', 'Roadmapping'], answer: 'A/B testing' },
      { question: 'When should a startup consider pivoting according to Eric Ries?', options: ['When metrics indicate failure', 'Based on customer feedback and learning', 'After completing full development', 'When investors push for change'], answer: 'Based on customer feedback and learning' },
      { question: 'What is a key benefit of aligning a company\'s values with human flourishing?', options: ['Increases short-term profits', 'Ensures long-term sustainability and trust', 'Reduces the need for innovation', 'Accelerates product launches'], answer: 'Ensures long-term sustainability and trust' },
    ],
},

  // ---- DESIGN TYPE ----
  {
    id: 'julie-zhuo',
    name: 'Julie Zhuo',
    title: 'Design Leader',
    type: 'Design',
    stats: { hp: 100, atk: 14, def: 9, spd: 15 },
    avatar: '/assets/avatars/Julie-Zhuo_pixel_art.webp',
    moves: [
      { name: 'Design Critique', type: 'Design', power: 24, description: 'Identifies flaws with surgical precision' },
      { name: 'Manager\'s Path', type: 'Design', power: 22, description: 'Leads with empathy and clarity' },
      { name: 'Pixel Perfect', type: 'Design', power: 28, description: 'Every detail aligned to the grid' },
      { name: 'User Empathy', type: 'Design', power: 20, description: 'Understands the opponent deeply' },
    ],
    trivia: [
      { question: 'What is a key trait of effective management in a rapidly changing environment?', options: ['Sturdy while flexible', 'Rigid and unchanging', 'Reactive and impulsive', 'Overly cautious'], answer: 'Sturdy while flexible' },
      { question: 'Why is management still critical even as organizational roles flatten?', options: ['To control all decisions', 'To set vision and coordinate resources', 'To perform all operational tasks', 'To eliminate hierarchy'], answer: 'To set vision and coordinate resources' },
      { question: 'What approach is recommended for effectively diagnosing business issues?', options: ['Use intuition alone', 'Use data and analysis', 'Follow gut feelings', 'Ask for executive approval'], answer: 'Use data and analysis' },
      { question: 'Which skill will likely become more valuable for managers as AI tools become prevalent?', options: ['Data interpretation', 'Technical coding', 'Manual problem-solving', 'Multitasking'], answer: 'Data interpretation' },
    ],
},
  {
    id: 'scott-belsky',
    name: 'Scott Belsky',
    title: 'Adobe CPO',
    type: 'Design',
    stats: { hp: 110, atk: 13, def: 11, spd: 12 },
    avatar: '/assets/avatars/Scott-Belsky_pixel_art.webp',
    moves: [
      { name: 'Creative Cloud', type: 'Design', power: 26, description: 'Summons the full Adobe suite' },
      { name: 'Messy Middle', type: 'Design', power: 24, description: 'Pushes through the hardest phase' },
      { name: 'Portfolio Strike', type: 'Design', power: 22, description: 'A curated collection of powerful hits' },
      { name: 'Ship It', type: 'Product', power: 30, description: 'Launches a decisive finishing move' },
    ],
    trivia: [
      { question: 'What is a key indicator to decide whether to persist with a startup idea?', options: ['Market size', 'Team strength', 'Conviction in the solution', 'Funding amount'], answer: 'Conviction in the solution' },
      { question: 'How should a product team approach building features, according to Scott Belsky?', options: ['Build all desired features', 'Focus on minimal features', 'Build only half the features you want', 'Ignore customer feedback'], answer: 'Build only half the features you want' },
      { question: 'What is a recommended mindset when you "lose conviction" in your product?', options: ['Double down on features', 'Pivot or quit', 'Increase marketing efforts', 'Ignore customer feedback'], answer: 'Pivot or quit' },
      { question: 'What is an effective way for product leaders to improve user experience?', options: ['Prioritize technology over design', 'Break down organizational boundaries', 'Focus solely on features', 'Avoid user empathy'], answer: 'Break down organizational boundaries' },
    ],
},
  {
    id: 'april-dunford',
    name: 'April Dunford',
    title: 'Positioning Expert',
    type: 'Design',
    stats: { hp: 108, atk: 15, def: 10, spd: 13 },
    avatar: '/assets/avatars/April-Dunford_pixel_art.webp',
    moves: [
      { name: 'Obviously Awesome', type: 'Design', power: 28, description: 'Positions the product perfectly in the market' },
      { name: 'Category Design', type: 'Design', power: 24, description: 'Creates an entirely new category to dominate' },
      { name: 'Competitive Alt', type: 'Product', power: 22, description: 'Reframes the competitive landscape' },
      { name: 'Value Prop', type: 'Design', power: 20, description: 'Communicates unique value instantly' },
    ],
    trivia: [
      { question: 'What is a recommended approach to craft a compelling sales pitch?', options: ['List all product features', 'Focus on customer benefits and values', 'Use technical jargon', 'Show detailed product specs'], answer: 'Focus on customer benefits and values' },
      { question: 'Why do many sales pitches end up being ineffective?', options: ['They are too brief', 'They lack alignment with positioning', 'They use too many stories', 'They focus only on price'], answer: 'They lack alignment with positioning' },
      { question: 'What is a best practice for testing a sales pitch\'s effectiveness?', options: ['Show all product features first', 'Test live with prospects and refine', 'Use only internal feedback', 'Make it as detailed as possible'], answer: 'Test live with prospects and refine' },
      { question: 'How can storytelling enhance a product sales pitch?', options: ['By making it more entertaining', 'By emphasizing technical details', 'By framing features in terms of customer impact', 'By using complex narratives'], answer: 'By framing features in terms of customer impact' },
    ],
},

  // ---- DATA TYPE ----
  {
    id: 'seth-godin',
    name: 'Seth Godin',
    title: 'Marketing Sage',
    type: 'Data',
    stats: { hp: 118, atk: 14, def: 10, spd: 12 },
    avatar: '/assets/avatars/Seth-Godin_pixel_art.webp',
    moves: [
      { name: 'Purple Cow', type: 'Data', power: 28, description: 'Stands out remarkably from the herd' },
      { name: 'Permission Marketing', type: 'Data', power: 22, description: 'Earns attention rather than demanding it' },
      { name: 'Tribe Rally', type: 'Data', power: 26, description: 'Mobilizes a loyal community' },
      { name: 'Shipping Streak', type: 'Data', power: 20, description: 'Ships consistently, every single day' },
    ],
    trivia: [
      { question: 'What should AI companies focus on to stand out?', options: ['Innovating features', 'Building brand and promise', 'Lowering prices', 'Copying competitors'], answer: 'Building brand and promise' },
      { question: 'How can one develop good taste in their work?', options: ['Copy top performers', 'Know what others want before they do', 'Take random risks', 'Avoid feedback'], answer: 'Know what others want before they do' },
      { question: 'According to Seth, what signifies high standards in product quality?', options: ['Perfection and luxury', 'Meeting specifications', 'How much you ship', 'Customer complaints'], answer: 'Meeting specifications' },
      { question: 'Which approach helps in building higher standards and better taste?', options: ['Working with high-standard people', 'Ignoring feedback', 'Lowering your standards', 'Focusing only on sales'], answer: 'Working with high-standard people' },
    ],
},
  {
    id: 'gibson-biddle',
    name: 'Gibson Biddle',
    title: 'Netflix Product Leader',
    type: 'Data',
    stats: { hp: 125, atk: 13, def: 13, spd: 10 },
    avatar: '/assets/avatars/Gibson-Biddle_pixel_art.webp',
    moves: [
      { name: 'DHM Model', type: 'Data', power: 24, description: 'Delight, Hard-to-copy, Margin-enhancing' },
      { name: 'A/B Slam', type: 'Data', power: 22, description: 'Tests two approaches and picks the winner' },
      { name: 'Metric Blast', type: 'Data', power: 26, description: 'Data-driven attacks optimized by analytics' },
      { name: 'Consumer Science', type: 'Data', power: 20, description: 'Understands users through experimentation' },
    ],
    trivia: [
      { question: 'What should be the primary goal of a product strategy?', options: ['Maximize revenue', 'Delight customers in a hard-to-copy way', 'Reduce costs', 'Increase user base quickly'], answer: 'Delight customers in a hard-to-copy way' },
      { question: 'Which framework is most effective for product prioritization?', options: ['RICE method', 'Value vs. Complexity', 'Strategy mapping', 'Balanced scorecard'], answer: 'Value vs. Complexity' },
      { question: 'How can a product team ensure their strategy is margin enhancing and hard to copy?', options: ['Cut costs aggressively', 'Focus on differentiation and customer delight', 'Add more features', 'Rapidly copy competitors'], answer: 'Focus on differentiation and customer delight' },
      { question: 'What is a nuance of applying product strategy frameworks in real-world scenarios?', options: ['Always stick to one model', 'Balance short-term gains with long-term differentiation', 'Ignore customer feedback', 'Prioritize quick wins above all'], answer: 'Balance short-term gains with long-term differentiation' },
    ],
},
  {
    id: 'kim-scott',
    name: 'Kim Scott',
    title: 'Radical Candor Author',
    type: 'Data',
    stats: { hp: 112, atk: 14, def: 11, spd: 11 },
    avatar: '/assets/avatars/Kim-Scott_pixel_art.webp',
    moves: [
      { name: 'Radical Candor', type: 'Data', power: 26, description: 'Cares personally while challenging directly' },
      { name: 'Direct Feedback', type: 'Data', power: 24, description: 'Honest critique that makes you stronger' },
      { name: 'Ruinous Empathy', type: 'Data', power: 18, description: 'Kindness without clarity — a deceptive move' },
      { name: 'Just Work', type: 'Data', power: 30, description: 'Eliminates workplace injustice' },
    ],
    trivia: [
      { question: 'What is the core idea of Radical Candor?', options: ['Care personally and challenge directly', 'Always be honest regardless of feelings', 'Avoid conflict at all costs', 'Focus solely on performance metrics'], answer: 'Care personally and challenge directly' },
      { question: 'Which quadrant describes giving candid feedback without showing care?', options: ['Obnoxious aggression', 'Ruined empathy', 'Manipulative insincerity', 'Radical candor'], answer: 'Obnoxious aggression' },
      { question: 'Why is ruinous empathy a common mistake in feedback?', options: ['Because people fear hurting feelings', 'Because it\'s easier than challenging', 'Because it\'s effective for team morale', 'Because it always leads to better results'], answer: 'Because people fear hurting feelings' },
      { question: 'How can a leader effectively use the radical candor framework?', options: ['As a conversation guide', 'To judge people harshly', 'To avoid giving feedback', 'As a strict rule set'], answer: 'As a conversation guide' },
    ],
},

  // ---- BOSS: BALANCED TYPE ----
  {
    id: 'lenny-rachitsky',
    name: 'Lenny Rachitsky',
    title: 'The Podcast Host',
    type: 'Product',
    stats: { hp: 150, atk: 15, def: 12, spd: 11 },
    avatar: '/assets/avatars/Lenny-Rachitsky_pixel_art.png', // .png (others are .webp) — matches actual file on disk
    moves: [
      { name: 'Newsletter Blast', type: 'Growth', power: 28, description: 'The #1 product newsletter hits hard' },
      { name: 'Guest Expert', type: 'Product', power: 24, description: 'Summons wisdom from hundreds of guests' },
      { name: 'Framework Drop', type: 'Data', power: 26, description: 'Deploys a battle-tested mental model' },
      { name: 'Community Power', type: 'Design', power: 22, description: 'The entire community rallies behind you' },
    ],
    trivia: [
      { question: 'What is a "T-shaped" professional?', options: ['Deep expertise in one area with broad knowledge across many', 'Someone who works in testing', 'A type of org structure', 'A career progression framework'], answer: 'Deep expertise in one area with broad knowledge across many' },
      { question: 'What is "dogfooding"?', options: ['Using your own product internally before releasing it', 'A type of user testing', 'A competitive analysis method', 'A marketing strategy'], answer: 'Using your own product internally before releasing it' },
      { question: 'What is "velocity" in agile?', options: ['The amount of work a team completes in a sprint', 'How fast code deploys', 'The speed of the website', 'Lines of code per day'], answer: 'The amount of work a team completes in a sprint' },
      { question: 'What is the "build-measure-learn" loop?', options: ['A lean startup methodology for iterating on ideas', 'A CI/CD pipeline', 'A code review process', 'A performance optimization technique'], answer: 'A lean startup methodology for iterating on ideas' },
    ],
},
];

/** All valid fighter IDs. Use this to validate client-supplied fighterId values. */
export const VALID_FIGHTER_IDS: string[] = FIGHTERS.map(f => f.id);

/** Look up a fighter by ID. Returns undefined if the ID is not in the roster. */
export function getFighterById(id: string): Fighter | undefined {
  return FIGHTERS.find(f => f.id === id);
}
