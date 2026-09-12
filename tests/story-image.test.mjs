import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedImageIsFresh,headlineMatches,previewImage,validArticleUrl,fetchStoryImage} from '../lib/story-image.ts';
const article='https://news.google.com/rss/articles/test';
const title='Robots & science advance';
const html='<img title="Robots &amp; science advance" src="/th?id=ONUT.example&amp;w=308&amp;h=200">';
test('matches exact normalized headline thumbnail and requests card resolution',()=>{
 const image=new URL(previewImage(html,title));assert.equal(image.origin,'https://www.bing.com');assert.equal(image.searchParams.get('w'),'720');assert.equal(image.searchParams.get('h'),'405');
 assert.equal(previewImage(html,'Unrelated robots headline'),null);
 assert.equal(previewImage(html.replace('ONUT','ODF'),title),null);
 assert.equal(previewImage(html.replace('/th?id=','https://evil.test/th?id='),title),null);
});
test('only known article paths may request image discovery',()=>{
 assert.equal(validArticleUrl(article),true);
 for(const url of ['https://news.google.com/','http://news.google.com/rss/articles/x','https://evil.test/rss/articles/x','https://user@news.google.com/rss/articles/x'])assert.equal(validArticleUrl(url),false);
});
test('uses fixed news-search destination and no redirects',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).origin,'https://www.bing.com');assert.equal(options.redirect,'error');return new Response(html,{headers:{'content-type':'text/html'}});};assert.ok(await fetchStoryImage(article,title));
 globalThis.fetch=async()=>{throw new Error('offline');};assert.equal(await fetchStoryImage(article,title),null);
 }finally{globalThis.fetch=original;}
});
test('missing and oversized images use fallback',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response('<html></html>',{headers:{'content-type':'text/html'}});assert.equal(await fetchStoryImage(article,title),null);
 globalThis.fetch=async()=>new Response('x'.repeat(2000001),{headers:{'content-type':'text/html'}});assert.equal(await fetchStoryImage(article,title),null);
 }finally{globalThis.fetch=original;}
});

test('small headline edits match but unrelated events and changed numbers do not',()=>{
 assert.equal(headlineMatches('Researchers discover new battery technology today','Researchers discover new battery technology'),true);
 assert.equal(headlineMatches('Researchers discover new cancer therapy','Researchers discover new battery technology'),false);
 assert.equal(headlineMatches('Company reports 15 percent profit increase','Company reports 10 percent profit increase'),false);
});
test('old cached failures retry and new misses expire in five minutes',()=>{
 const now=Date.now();
 assert.equal(cachedImageIsFresh({imageUrl:null},now),false);
 assert.equal(cachedImageIsFresh({imageUrl:null,imageVersion:2,imageCheckedAt:new Date(now).toISOString()},now),true);
 assert.equal(cachedImageIsFresh({imageUrl:null,imageVersion:2,imageCheckedAt:new Date(now-300001).toISOString()},now),false);
 assert.equal(cachedImageIsFresh({imageUrl:'https://www.bing.com/th?id=ONUT.example'},now),true);
});
