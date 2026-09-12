import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedback, rankFeed, storyFeatures, trainModel, MAX_FEEDBACK, preferencePairs, recencyScore, extractKeywords, withCoverage, refreshDue, normalizeFeedback, discoveryKeywords } from '../lib/feed-learning.ts';

const now = Date.parse('2026-09-12T12:00:00Z');
const story = (title, id, hours = 1, source = 'Publisher') => ({ title, url: `https://news.google.com/rss/articles/${id}`, category: 'Interests', source, publishedAt: new Date(now - hours * 3600000).toISOString(), reasons: ['From your interests search'] });
const robotics = story('Robotics laboratory develops autonomous robots', 'training');
const related = story('Autonomous robotics research advances robots', 'unseen');
const art = story('Festival celebrates painting and sculpture', 'art');
const artNew = story('Painting sculpture festival opens today', 'art-new');
const example = (item, rating) => ({ url: item.url, rating, ratedAt: new Date(now + 1000).toISOString(), features: storyFeatures(item, [robotics, art], now) });
const feed = { stories: [artNew, related], fetchedAt: new Date(now).toISOString(), cached: false };

test('pair labels preserve every star level, ignore ties, and weight rating gaps', () => {
  const pairs = preferencePairs([example(robotics, 5), example(art, 2)]);
  assert.equal(pairs.length, 1); assert.equal(pairs[0].label, 0); assert.equal(pairs[0].importance, .75);
  assert.equal(preferencePairs([example(robotics, 2), example(art, 5)])[0].label, 1);
  assert.equal(preferencePairs([example(robotics, 3), example(art, 3)]).length, 0);
  assert.equal(preferencePairs([example(robotics, 4), example(art, 3)])[0].importance, .25);
});
test('paired preferences generalize to unseen stories and reversing ratings reverses order', () => {
  assert.equal(rankFeed(feed, [example(robotics, 5), example(art, 1)], now).stories[0].url, related.url);
  assert.equal(rankFeed(feed, [example(robotics, 1), example(art, 5)], now).stories[0].url, artNew.url);
});
test('logarithmic recency decays fastest early, handles bad/future dates, favors fresh cold-start stories', () => {
  const score = h => recencyScore(new Date(now - h * 3600000).toISOString(), now);
  assert.equal(score(0), 1); assert.ok(score(0)-score(1) > score(24)-score(25));
  assert.ok(score(1)>score(24)); assert.equal(score(-1),1); assert.equal(recencyScore('invalid',now),0);
  const fresh=story('Science discovery', 'fresh',0), old=story('Science discovery','old',48);
  assert.equal(rankFeed({...feed,stories:[old,fresh]},[],now).stories[0].url,fresh.url);
});
test('all component weights learn from binary pairwise labels', () => {
  for (const component of ['recency','keyword','popularity']) {
    const low={url:'low',rating:1,features:[[component,0]]}, high={url:'high',rating:5,features:[[component,1]]};
    assert.ok(trainModel([low,high]).get(component) > trainModel([]).get(component));
    assert.ok(trainModel([{...low,rating:5},{...high,rating:1}]).get(component) < trainModel([]).get(component));
  }
});
test('keywords remove stopwords, TF-IDF boosts uncommon tokens and remains finite', () => {
  assert.deepEqual(extractKeywords('The ROBOTS robots and 2026'), ['robots']);
  const target=story('Robots science','x');
  const f=new Map(storyFeatures(target,[target,story('Science advances','y')],now));
  assert.ok(f.get('word:robots')>f.get('word:science'));
  assert.ok(storyFeatures(story('the and','empty'),[],now).every(([,v])=>Number.isFinite(v)));
});
test('coverage counts independent similar publishers, not duplicate syndication entries or unrelated stories', () => {
  const base=story('Robotics laboratory develops autonomous robots','one',1,'Publisher A');
  const items=withCoverage([base,{...base,url:'two',source:'Publisher B'},{...base,url:'three'},art]);
  assert.equal(items[0].coverageSources,2); assert.equal(items[3].coverageSources,1);
  assert.ok(new Map(storyFeatures(items[0])).get('popularity')>0);
  assert.equal(new Map(storyFeatures(art)).get('popularity'),0);
});
test('refresh requires five distinct ratings since last successful fetch; edits and old ratings cannot inflate it', () => {
  const ratings=Array.from({length:5},(_,i)=>example(story('Robotics science',String(i)),i%5+1));
  assert.equal(refreshDue(ratings.slice(0,4),feed.fetchedAt),false);
  assert.equal(refreshDue(ratings,feed.fetchedAt),true);
  assert.equal(refreshDue([...ratings.slice(0,4),ratings[0]],feed.fetchedAt),false);
  assert.equal(refreshDue(ratings,new Date(now+2000).toISOString()),false);
  assert.equal(refreshDue(ratings.map(x=>({...x,ratedAt:''})),feed.fetchedAt),false);
});
test('ranking selects unseen real candidates beyond original 40, bounds output and does not mutate inputs or expose model state', () => {
  const stories=Array.from({length:60},(_,i)=>story('Science advances',String(i),i));
  const snapshot=structuredClone(stories);
  const ranked=rankFeed({...feed,stories},[example(stories[0],5)],now);
  assert.equal(ranked.stories.length,40); assert.equal(ranked.stories[0].url,stories[1].url);
  assert.deepEqual(stories,snapshot); assert.equal(ranked.learning,undefined);
  assert.ok(ranked.stories.every(s=>stories.some(candidate=>candidate.url===s.url)));
});
test('legacy feedback migrates; malformed ratings and features do not enter training', () => {
  const legacy={url:'legacy',value:'more',features:[['word:robots',1],['bad',NaN]]};
  assert.deepEqual(normalizeFeedback([legacy]),[{url:'legacy',rating:5,ratedAt:'',features:[['word:robots',1]]}]);
  assert.equal(normalizeFeedback([null,{...legacy,rating:6}]).length,0);
});
test('training is bounded, deterministic, finite, and tied feedback falls back to priors', () => {
  const ratings=Array.from({length:MAX_FEEDBACK},(_,i)=>({...example(i%2?robotics:art,i%2?5:1),url:String(i)}));
  const weights=trainModel(ratings);
  assert.deepEqual(weights,trainModel([example(related,2),...ratings]));
  assert.deepEqual(weights,trainModel(structuredClone(ratings)));
  assert.ok([...weights.values()].every(Number.isFinite));
  assert.deepEqual(trainModel([example(robotics,3),example(art,3)]),trainModel([]));
  assert.equal(discoveryKeywords(ratings).length<=3,true);
  assert.ok(discoveryKeywords(ratings).includes('robotics'));
});
test('feedback validation accepts only integer star ratings and clear with a bounded URL', () => {
  for (const body of [null,{}, {action:'rate',url:'x'}, ...[0,6,2.5,'5',null].map(rating=>({action:'rate',url:'x',rating})),{action:'reset'},{action:'more',url:'x'},{action:'rate',url:'x'.repeat(4097),rating:5}]) assert.throws(()=>parseFeedback(body));
  assert.deepEqual(parseFeedback({action:'rate',url:'x',rating:3}),{action:'rate',url:'x',rating:3});
  assert.deepEqual(parseFeedback({action:'clear',url:'x'}),{action:'clear',url:'x'});
});
