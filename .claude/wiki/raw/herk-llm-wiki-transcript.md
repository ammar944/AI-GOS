# Nate Herk — Andrej Karpathy Just 10x'd Everyone's Claude Code

- Source: YouTube, channel @nateherk
- Video ID: sboNwYmH3AY
- Ingested: 2026-04-20
- Status: pending ingest into wiki/

---

What you're looking at right here is 36 of my most recent YouTube videos organized into an actual knowledge system that makes sense. And in today's video, I'm going to show you how you can set this up in 5 minutes. It's super super easy. You can see here how we have these different nodes and different patterns emerging. And as we zoom in, we can see what each of these little dots represents. So, for example, this is one of my videos, $10,000 aentic workflows. We can see it's got some tags. It's got the video link. It's got the raw file. And it gives an explanation of what this video is about and what the takeaways are.

And the coolest part is I can follow the back links to get where I want. There's a backlink for the WAT framework. There's a backlink for Claude Code. There's a backlink for all these different tools I mentioned like Perplexity, Visual Studio Code, Nano Banana, Naden N. It also has techniques like the WT framework or bypass permissions mode or human review checkpoint. So, as this continues to fill up, we can start to see patterns and relationships between every tool or every skill or every MCP server that I might have talked about in a YouTube video. And I can just query it in a really efficient way now that we have this actual system set up.

And the crazy part is I said, "Hey, Cloud Code, go grab the transcripts from my recent videos and organize everything. I literally didn't have to do any manual relationship building here. It just figured it all out on its own." And then right here, I have a much smaller one, but this is more of my personal brain. So this is stuff going on in my personal life. This is stuff going on with, you know, UpAI or my YouTube channel or my different businesses and my employees and our quarter 2 initiatives and things like that. This is more of my own second brain. So I've got one second brain here and then I've got one basically YouTube knowledge system and I could combine these or I could keep them separate and I can just keep building more knowledge systems and plug them all into other AI agents that I need to have this context.

So Andre Carpathy just released this little post about LLM knowledge bases and explaining what he's been doing with them. And in just a matter of few days, it got a ton of traction on X. Something I've been finding very useful recently is using LLM to build personal knowledge bases for various topics of research interest. So there's different stages. The first part is data ingest. He puts in basically source documents. So he basically takes a PDF and puts it into Cloud Code and then Cloud Code does the rest. He uses Obsidian as the IDE. So this is nothing really too game-changing. Obsidian just lets you visually see your markdown files.

And then there's a Q&A phase where you basically can ask questions about YouTube or about the research and it can look through the entire wiki in a much more efficient way and it can give you answers that are super intelligent. He said here, "I thought that I had to reach for fancy rag, but the LLM has been pretty good about automaintaining index files and brief summaries of all documents and it reads all the important related data fairly easily at this small scale."

So right now he's doing about 100 articles and about half a million words. The TLDR is you give raw data to cloud code. It compares it, it organizes it, and then it puts it into the right spots with relationships, and then you can query it about anything. And it can help you identify where there's gaps in that node or in that relationship, and it can go do research and fill in the gaps.

All right. So why is this a big deal? Because normal AI chats are ephemeral, meaning the knowledge disappears after the conversation. But this method, using Karpathy's LLM wiki, makes knowledge compound like interest in a bank. People on X are calling it a game changer because it finally makes AI feel like a tireless colleague who actually remembers everything and it stays organized. It's also super simple. It will take you five minutes to set up. You don't need a fancy vector database embeddings or complex infrastructure. It's literally just a folder with markdown files. That's it.

You literally just have a vault up top. So in this example, it's called my wiki. You've got a raw folder where you put all of the stuff. And then you've got a wiki folder, which is what the LLM takes from your raw and puts it into the wiki. So in here you have all the wiki pages which it will create but then you also have an index and you have a log. You can see that I have all these different tools, different techniques (agent teams, sub agents, permission modes, the WAT framework), different concepts (MCP servers, rag, vibe coding), different sources (the YouTube videos), and then when I have people or comparisons they will be put in here in the index. And then we also have a log which is the operation history.

One X user turned 383 scattered files and over a 100 meeting transcripts into a compact wiki and dropped token usage by 95% when querying with Claude.

The other thing that's really cool about this is there's not really like a GitHub repo you go copy or there's not a complicated setup. You literally just say hey cloud code read this idea from Andre Karpathy and implement it. And Karpathy even said, "Hey, I left this prompt vague so that you guys can customize it."

By default, it threw in four folders. It threw in analysis, concepts, entities, and sources. Once we start to populate stuff, we can talk to it to see if that's actually the way we want to do it or not. Carpathy actually said, "Sometimes I like to keep it really simple and really flat, which means like no subfolders and not a bunch of over organizing." But then in the YouTube transcript one, there were different subfolders and in this case it actually makes more sense.

In the YouTube project the log isn't huge cuz I only ran one huge batch of the initial 36 YouTube videos, but now every time I have one, I say, "Hey, can you go ahead and ingest the new YouTube video into the wiki and then we'll see every single time we update this." And then, of course, you need your claw.md to explain how the project works and how to search through things and how to update things.

When I uploaded the 36 YouTube transcripts in batch, it took about 14 minutes. So it kind of just depends, but it created 23 wiki pages. We have the source. We have six people, five organizations and one AI systems page, different concepts, so technical alignment and geopolitical and then an analysis and then it asks some questions about it so that it can help make the relationships and make the structure even better.

So the thing about the hot cache. If I go to YouTube, you can see there's no hot cache. But if I go to the herk brain in the wiki, you can see there's a hot.md right here. And this is basically just a cache of like 500 words or 500 characters that it saves, which is like what is the most recent thing that Nate just gave me or that we talked about. In the context of my executive assistant, this is really helpful. You know, it might save me from having to crawl different wiki pages. But in something like the YouTube transcript project, I don't really need a hot cache.

So another thing that I alluded to but didn't really cover was the idea of linting. So Karpathi says that he runs some LLM health checks over the wiki to find inconsistent data, impute missing data with web searches, find interesting connections for new article candidates, things like that. So it basically helps you run a lint, you know, every day, every week, whenever you want, which helps make sure that everything is scalable and structured in the right way.

So now the final question about this that I wanted to cover is like does this kill semantic search rag? And the answer is no, but kind of yes. And it all depends on the goal of the project and the goal of the context, how much context you have.

Karpathy knowledge vs typical semantic search RAG:
- Finds info: By reading indexes and following links rather than using similarity search. Gets deeper understanding of relationships because they're links rather than "these chunks seem similar."
- Infrastructure: Literally just markdown. Whereas with semantic search, you need an embedding model, a vector database and a chunking pipeline.
- Cost: Basically free (just tokens). Whereas semantic search has ongoing compute and storage.
- Maintenance: Just run a lint. Clean up things. Add more articles. Rather than having to re-embed when things change.
- Weakness: Doesn't scale huge across enterprises because it's just a bunch of files. If you get up to millions of documents, you're going to want to do more of a traditional rag pipeline. Hundreds of pages with good indexes, wiki graph is fine.
