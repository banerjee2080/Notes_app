import Note from "../models/note.model.js";

export const getAllNotes = async(req,res) => {
    try{
        const creatorId = req.user._id;
        const data = await Note.find({ creatorId }).sort({createdAt:-1});
        res.status(200).json(data);
    }
    catch(error){
        console.error("Error in getAllNotes controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getNotesById = async(req,res) => {
    try{
        const creatorId = req.user._id;
        const data = await Note.findOne({ _id: req.params.id, creatorId });
        if(!data)return res.status(404).json({message:"Note not found!"});
        res.status(200).json(data);
    }
    catch(error){
        console.error("Error in getNoteById controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const addNote = async(req,res) => {
    try{
        const {title,content} = req.body;
        const creatorId = req.user._id;
        const note = new Note({title,content, creatorId});

        const savedNote = await note.save();
        res.json(savedNote);
    }
    catch(error){
        console.log("Error Creating new Note ",error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const modifyNote = async(req,res) => {
    try{
        const id = req.params.id;
        const {title,content} = req.body;
        const creatorId = req.user._id;

        const modifiedNote = await Note.findByIdAndUpdate(
          id,
          { title, content },
          { new: true },
        );
        if (!modifiedNote) return res.status(404).json({ message: "Note not found" });
        res.status(200).json(modifiedNote);
    }
    catch(error){
        console.log("Error Updating note ",error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const delNote=  async(req,res) => {
    try {
      const deletedNote = await Note.findByIdAndDelete(req.params.id);
      if (!deletedNote)return res.status(404).json({ message: "Note not found" });
      res.status(200).json({ message: "Note deleted successfully!" });
    } 
    catch (error) {
      console.error("Error in Deleting Note", error);
      res.status(500).json({ message: "Internal server error" });
    }
}